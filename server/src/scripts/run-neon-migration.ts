import { Pool } from 'pg';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const sqlite = new Database('./data/hostel_safety.db');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('Connecting to Neon PostgreSQL...');
  const client = await pool.connect();
  console.log('Connected! Verifying database...');

  const schemaSql = fs.readFileSync(path.resolve('./src/migrations/postgres_schema.sql'), 'utf8');
  console.log('Applying schema...');
  await client.query(schemaSql);
  console.log('Schema applied successfully.');

  console.log('Migrating hostels...');
  const hostels = sqlite.prepare('SELECT * FROM hostels').all() as any[];
  for (const h of hostels) {
    await client.query(
      `INSERT INTO hostels (id, name, code, address, latitude, longitude, geofence_radius_meters)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
      [h.id, h.name, h.code, h.address, h.latitude, h.longitude, h.geofence_radius_meters]
    );
  }
  console.log(`Hostels migrated: ${hostels.length}`);

  console.log('Migrating blocks...');
  const blocks = sqlite.prepare('SELECT * FROM blocks').all() as any[];
  for (const b of blocks) {
    await client.query(
      `INSERT INTO blocks (id, hostel_id, name, code, gender, total_floors)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
      [b.id, b.hostel_id, b.name, b.code, b.gender, b.total_floors]
    );
  }
  console.log(`Blocks migrated: ${blocks.length}`);

  console.log('Migrating floors...');
  const floors = sqlite.prepare('SELECT * FROM floors').all() as any[];
  for (const f of floors) {
    await client.query(
      `INSERT INTO floors (id, block_id, floor_number, name)
       VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [f.id, f.block_id, f.floor_number, f.name]
    );
  }
  console.log(`Floors migrated: ${floors.length}`);

  console.log('Migrating rooms...');
  const rooms = sqlite.prepare('SELECT * FROM rooms').all() as any[];
  for (let i = 0; i < rooms.length; i += 50) {
    const chunk = rooms.slice(i, i + 50);
    const placeholders: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const r of chunk) {
      placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
      params.push(r.id, r.floor_id, r.block_id, r.room_number, r.capacity, r.occupied_count, r.status);
    }
    await client.query(
      `INSERT INTO rooms (id, floor_id, block_id, room_number, capacity, occupied_count, status)
       VALUES ${placeholders.join(', ')} ON CONFLICT (id) DO NOTHING`,
      params
    );
  }
  console.log(`Rooms migrated: ${rooms.length}`);

  console.log('Migrating users...');
  const users = sqlite.prepare('SELECT * FROM users').all() as any[];
  for (let i = 0; i < users.length; i += 50) {
    const chunk = users.slice(i, i + 50);
    const placeholders: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const u of chunk) {
      placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
      params.push(u.id, u.username, u.email, u.password_hash, u.role, u.full_name, u.phone, u.avatar_url, u.status);
    }
    await client.query(
      `INSERT INTO users (id, username, email, password_hash, role, full_name, phone, avatar_url, status)
       VALUES ${placeholders.join(', ')} ON CONFLICT (id) DO NOTHING`,
      params
    );
  }
  console.log(`Users migrated: ${users.length}`);

  console.log('Migrating students...');
  const students = sqlite.prepare('SELECT * FROM students').all() as any[];
  for (let i = 0; i < students.length; i += 50) {
    const chunk = students.slice(i, i + 50);
    const placeholders: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const s of chunk) {
      placeholders.push(
        `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`
      );
      params.push(
        s.id, s.user_id, s.roll_number, s.full_name, s.email, s.phone, s.emergency_phone,
        s.parent_name, s.parent_phone, s.hostel_id, s.block_id, s.floor_id, s.room_id,
        s.room_number, s.department, s.year_of_study, s.current_status, s.has_face_enrolled,
        s.face_descriptor, s.face_enrolled_at, s.attendance_exempt
      );
    }
    await client.query(
      `INSERT INTO students (
        id, user_id, roll_number, full_name, email, phone, emergency_phone,
        parent_name, parent_phone, hostel_id, block_id, floor_id, room_id,
        room_number, department, year_of_study, current_status, has_face_enrolled,
        face_descriptor, face_enrolled_at, attendance_exempt
      ) VALUES ${placeholders.join(', ')} ON CONFLICT (id) DO NOTHING`,
      params
    );
  }
  console.log(`Students migrated: ${students.length}`);

  console.log('Migrating attendance...');
  const attendance = sqlite.prepare('SELECT * FROM attendance_records').all() as any[];
  for (let i = 0; i < attendance.length; i += 50) {
    const chunk = attendance.slice(i, i + 50);
    const placeholders: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const a of chunk) {
      placeholders.push(
        `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`
      );
      params.push(
        a.id, a.student_id, a.date, a.session_name, a.status, a.verification_method,
        a.confidence_score, a.liveness_verified, a.location_verified, a.latitude,
        a.longitude, a.distance_from_hostel_meters, a.failure_reason, a.timestamp
      );
    }
    await client.query(
      `INSERT INTO attendance_records (
        id, student_id, date, session_name, status, verification_method,
        confidence_score, liveness_verified, location_verified, latitude,
        longitude, distance_from_hostel_meters, failure_reason, timestamp
      ) VALUES ${placeholders.join(', ')} ON CONFLICT (id) DO NOTHING`,
      params
    );
  }
  console.log(`Attendance records migrated: ${attendance.length}`);

  console.log('Migrating leaves...');
  const leaves = sqlite.prepare('SELECT * FROM leave_requests').all() as any[];
  for (let i = 0; i < leaves.length; i += 50) {
    const chunk = leaves.slice(i, i + 50);
    const placeholders: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const l of chunk) {
      placeholders.push(
        `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`
      );
      params.push(
        l.id, l.student_id, l.leave_type, l.reason, l.destination, l.departure_date,
        l.expected_return_date, l.status, l.parent_informed, l.parent_consent_phone,
        l.warden_remarks, l.reviewed_by_user_id, l.reviewed_at, l.created_at
      );
    }
    await client.query(
      `INSERT INTO leave_requests (
        id, student_id, leave_type, reason, destination, departure_date,
        expected_return_date, status, parent_informed, parent_consent_phone,
        warden_remarks, reviewed_by_user_id, reviewed_at, created_at
      ) VALUES ${placeholders.join(', ')} ON CONFLICT (id) DO NOTHING`,
      params
    );
  }
  console.log(`Leaves migrated: ${leaves.length}`);

  console.log('Migrating movements...');
  const movements = sqlite.prepare('SELECT * FROM movement_records').all() as any[];
  for (let i = 0; i < movements.length; i += 50) {
    const chunk = movements.slice(i, i + 50);
    const placeholders: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const m of chunk) {
      placeholders.push(
        `($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`
      );
      params.push(
        m.id, m.student_id, m.leave_request_id, m.movement_type, m.status,
        m.actual_departure_time, m.expected_return_time, m.actual_return_time,
        m.departure_gate, m.return_gate, m.is_overdue, m.overdue_minutes, m.created_at
      );
    }
    await client.query(
      `INSERT INTO movement_records (
        id, student_id, leave_request_id, movement_type, status,
        actual_departure_time, expected_return_time, actual_return_time,
        departure_gate, return_gate, is_overdue, overdue_minutes, created_at
      ) VALUES ${placeholders.join(', ')} ON CONFLICT (id) DO NOTHING`,
      params
    );
  }
  console.log(`Movements migrated: ${movements.length}`);

  console.log('Migrating exceptions...');
  const exceptions = sqlite.prepare('SELECT * FROM exception_alerts').all() as any[];
  for (const e of exceptions) {
    await client.query(
      `INSERT INTO exception_alerts (id, student_id, type, severity, status, title, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
      [e.id, e.student_id, e.type, e.severity, e.status, e.title, e.description, e.created_at]
    );
  }
  console.log(`Exceptions migrated: ${exceptions.length}`);

  console.log('Migrating settings...');
  const settings = sqlite.prepare('SELECT * FROM system_settings').all() as any[];
  for (const st of settings) {
    await client.query(
      `INSERT INTO system_settings (key, value, description)
       VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [st.key, st.value, st.description]
    );
  }
  console.log(`Settings migrated: ${settings.length}`);

  client.release();
  await pool.end();
  console.log('🎉 Migration completely finished successfully!');
}

main().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
