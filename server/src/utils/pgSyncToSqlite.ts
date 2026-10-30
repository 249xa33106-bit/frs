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

    // ── 1. Sync real users (non-admin/warden created via registration) ──────────
    const { rows: pgUsers } = await client.query(`
      SELECT id, username, email, password_hash, role, full_name, phone, avatar_url, status, created_at
      FROM users
      WHERE id LIKE 'usr-real-%'
    `);

    const insertUser = sqliteDb.prepare(`
      INSERT OR IGNORE INTO users (id, username, email, password_hash, role, full_name, phone, avatar_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
             face_descriptor, face_enrolled_at, attendance_exempt, created_at
      FROM students
      WHERE id LIKE 'std-real-%'
      ORDER BY created_at ASC
    `);

    const insertStudent = sqliteDb.prepare(`
      INSERT OR IGNORE INTO students (
        id, user_id, roll_number, full_name, email, phone, emergency_phone,
        parent_name, parent_phone, hostel_id, block_id, floor_id, room_id,
        room_number, department, year_of_study, current_status, has_face_enrolled,
        face_descriptor, face_enrolled_at, attendance_exempt, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?
      )
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
        s.created_at ? (s.created_at instanceof Date ? s.created_at.toISOString() : String(s.created_at)) : new Date().toISOString()
      );
    }

    // ── 3. Recalculate room occupancy after restore ──────────────────────────────
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
