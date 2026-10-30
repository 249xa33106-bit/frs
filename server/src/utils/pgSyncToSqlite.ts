/**
 * pgSyncToSqlite.ts
 * On startup, pulls all real registered students (and their users) from
 * Neon PostgreSQL and inserts them into the local SQLite database.
 * This ensures data survives Render's ephemeral filesystem across redeploys.
 */

import { db as sqliteDb } from '../db.js';
import { pgPool } from '../postgres.js';

export async function syncPostgresToSqlite(): Promise<void> {
  const url = (process.env.DATABASE_URL || '').trim();
  if (!url) {
    console.log('[PG→SQLite] No DATABASE_URL set — skipping PostgreSQL restore.');
    return;
  }

  let client: any = null;
  try {
    client = await pgPool.connect();
    console.log('[PG→SQLite] Connected to Neon PostgreSQL. Restoring registered students...');

    // ── 0. Ensure schema compatibility (photo_url, avatar_url) ─────────────────
    try {
      await client.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url TEXT');
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT');
    } catch (e) {}

    // ── 1. Sync real users (non-admin/warden created via registration) ──────────
    const { rows: pgUsers } = await client.query(`
      SELECT id, username, email, password_hash, role, full_name, phone, avatar_url, status, created_at
      FROM users
      WHERE role = 'student' AND (id LIKE 'usr-real-%' OR NOT username LIKE 'tagore%')
    `);

    const insertUser = sqliteDb.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, full_name, phone, avatar_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        username = excluded.username,
        email = excluded.email,
        full_name = excluded.full_name,
        phone = excluded.phone,
        avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
        status = excluded.status
    `);

    for (const u of pgUsers) {
      insertUser.run(u.id, u.username, u.email, u.password_hash, u.role, u.full_name, u.phone, u.avatar_url ?? null, u.status ?? 'Active');
    }
    console.log(`[PG→SQLite] Restored ${pgUsers.length} user accounts.`);

    // ── 2. Sync real students ────────────────────────────────────────────────────
    const { rows: pgStudents } = await client.query(`
      SELECT id, user_id, roll_number, full_name, email, phone, emergency_phone,
             parent_name, parent_phone, hostel_id, block_id, floor_id, room_id,
             room_number, department, year_of_study, current_status, has_face_enrolled,
             face_descriptor, face_enrolled_at, attendance_exempt, photo_url, created_at
      FROM students
      WHERE id LIKE 'std-real-%' OR NOT (roll_number LIKE 'TAGORE-%' OR id LIKE 'std-0%')
      ORDER BY created_at ASC
    `);

    const insertStudent = sqliteDb.prepare(`
      INSERT INTO students (
        id, user_id, roll_number, full_name, email, phone, emergency_phone,
        parent_name, parent_phone, hostel_id, block_id, floor_id, room_id,
        room_number, department, year_of_study, current_status, has_face_enrolled,
        face_descriptor, face_enrolled_at, attendance_exempt, photo_url, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        roll_number = excluded.roll_number,
        full_name = excluded.full_name,
        email = excluded.email,
        phone = excluded.phone,
        room_number = excluded.room_number,
        block_id = excluded.block_id,
        has_face_enrolled = excluded.has_face_enrolled,
        face_descriptor = COALESCE(excluded.face_descriptor, students.face_descriptor),
        face_enrolled_at = COALESCE(excluded.face_enrolled_at, students.face_enrolled_at),
        photo_url = COALESCE(excluded.photo_url, students.photo_url)
    `);

    for (const s of pgStudents) {
      insertStudent.run(
        s.id,
        s.user_id,
        s.roll_number,
        s.full_name,
        s.email,
        s.phone,
        s.emergency_phone ?? s.phone,
        s.parent_name ?? 'Guardian',
        s.parent_phone ?? s.phone,
        s.hostel_id ?? 'hostel-tagore-main',
        s.block_id ?? 'block-a',
        s.floor_id ?? 'floor-block-a-1',
        s.room_id ?? null,
        s.room_number ?? null,
        s.department ?? 'Computer Science & Engineering',
        typeof s.year_of_study === 'number' ? s.year_of_study : 1,
        s.current_status ?? 'Inside',
        s.has_face_enrolled ? 1 : 0,
        s.face_descriptor ? String(s.face_descriptor) : null,
        s.face_enrolled_at ? (s.face_enrolled_at instanceof Date ? s.face_enrolled_at.toISOString() : String(s.face_enrolled_at)) : null,
        s.attendance_exempt ? 1 : 0,
        s.photo_url ? String(s.photo_url) : null,
        s.created_at ? (s.created_at instanceof Date ? s.created_at.toISOString() : String(s.created_at)) : new Date().toISOString()
      );
    }

    // ── 3. Sync attendance records from Neon PostgreSQL ───────────────────────────
    try {
      // Only sync attendance records for students that actually exist in SQLite
      const { rows: pgAttendance } = await client.query(`
        SELECT a.id, a.student_id, a.date, a.session_name, a.status, a.verification_method,
               a.confidence_score, a.liveness_verified, a.location_verified, a.latitude,
               a.longitude, a.distance_from_hostel_meters, a.failure_reason, a.timestamp,
               a.verified_by_user_id
        FROM attendance_records a
        WHERE a.student_id LIKE 'std-real-%'
           OR a.student_id IN (SELECT id FROM students WHERE id LIKE 'std-real-%' OR NOT (roll_number LIKE 'TAGORE-%' OR id LIKE 'std-0%'))
        ORDER BY a.timestamp DESC
        LIMIT 5000
      `);

      const insertAttendance = sqliteDb.prepare(`
        INSERT OR IGNORE INTO attendance_records (
          id, student_id, date, session_name, status, verification_method,
          confidence_score, liveness_verified, location_verified, latitude,
          longitude, distance_from_hostel_meters, failure_reason, timestamp,
          verified_by_user_id
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?
        )
      `);

      let syncedCount = 0;
      for (const a of pgAttendance) {
        // Double-check student exists in SQLite
        const exists = sqliteDb.prepare('SELECT id FROM students WHERE id = ?').get(a.student_id);
        if (exists) {
          insertAttendance.run(
            a.id,
            a.student_id,
            a.date ? (a.date instanceof Date ? a.date.toISOString().split('T')[0] : String(a.date).slice(0, 10)) : new Date().toISOString().split('T')[0],
            a.session_name || 'Evening Curfew Check',
            a.status || 'Present',
            a.verification_method || 'Face + Geolocation',
            a.confidence_score ? Number(a.confidence_score) : 0.95,
            a.liveness_verified ? 1 : 0,
            a.location_verified ? 1 : 0,
            a.latitude ? Number(a.latitude) : 15.774299,
            a.longitude ? Number(a.longitude) : 78.054718,
            a.distance_from_hostel_meters ? Number(a.distance_from_hostel_meters) : 0,
            a.failure_reason ?? null,
            a.timestamp ? (a.timestamp instanceof Date ? a.timestamp.toISOString() : String(a.timestamp)) : new Date().toISOString(),
            a.verified_by_user_id ?? null
          );
          syncedCount++;
        }
      }
      console.log(`[PG→SQLite] ✅ Restored ${syncedCount} attendance records for registered students into SQLite.`);
    } catch (attErr: any) {
      console.warn('[PG→SQLite] Attendance records sync warning:', attErr.message);
    }

    // ── 4. Recalculate room occupancy after restore ──────────────────────────────
    sqliteDb.prepare(`
      UPDATE rooms
      SET occupied_count = (SELECT COUNT(*) FROM students WHERE room_id = rooms.id)
    `).run();

    console.log(`[PG→SQLite] ✅ Restored ${pgStudents.length} registered students from PostgreSQL into SQLite.`);
  } catch (err: any) {
    console.warn('[PG→SQLite] Could not sync from PostgreSQL:', err.message);
  } finally {
    if (client) client.release();
  }
}
