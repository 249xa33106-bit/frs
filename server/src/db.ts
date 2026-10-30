import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { safePgQuery } from './postgres.js';

const DB_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'hostel_safety.db');
export const db = new Database(DB_PATH);

// Enable foreign keys and WAL mode for high concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    -- Hostels
    CREATE TABLE IF NOT EXISTS hostels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      address TEXT,
      latitude REAL DEFAULT 15.774299,
      longitude REAL DEFAULT 78.054718,
      geofence_radius_meters INTEGER DEFAULT 35,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Blocks
    CREATE TABLE IF NOT EXISTS blocks (
      id TEXT PRIMARY KEY,
      hostel_id TEXT REFERENCES hostels(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      gender TEXT DEFAULT 'Co-ed',
      total_floors INTEGER DEFAULT 4,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Floors
    CREATE TABLE IF NOT EXISTS floors (
      id TEXT PRIMARY KEY,
      block_id TEXT REFERENCES blocks(id) ON DELETE CASCADE,
      floor_number INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Rooms
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      floor_id TEXT REFERENCES floors(id) ON DELETE CASCADE,
      block_id TEXT REFERENCES blocks(id) ON DELETE CASCADE,
      room_number TEXT NOT NULL,
      capacity INTEGER DEFAULT 4,
      occupied_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Available',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Users
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('student', 'warden', 'admin')),
      full_name TEXT NOT NULL,
      phone TEXT,
      avatar_url TEXT,
      status TEXT DEFAULT 'Active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_login TEXT
    );

    -- Students
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      roll_number TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      emergency_phone TEXT NOT NULL,
      parent_name TEXT NOT NULL,
      parent_phone TEXT NOT NULL,
      hostel_id TEXT REFERENCES hostels(id),
      block_id TEXT REFERENCES blocks(id),
      floor_id TEXT REFERENCES floors(id),
      room_id TEXT REFERENCES rooms(id),
      room_number TEXT NOT NULL,
      department TEXT NOT NULL,
      year_of_study INTEGER NOT NULL,
      current_status TEXT DEFAULT 'Inside' CHECK(current_status IN ('Inside', 'Outside', 'On Leave', 'Unknown')),
      has_face_enrolled INTEGER DEFAULT 0,
      face_descriptor TEXT,
      face_enrolled_at TEXT,
      attendance_exempt INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Attendance Records
    CREATE TABLE IF NOT EXISTS attendance_records (
      id TEXT PRIMARY KEY,
      student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      session_name TEXT DEFAULT 'Evening Curfew Check',
      status TEXT NOT NULL CHECK(status IN ('Present', 'Absent', 'Verification Failed', 'Excused', 'Late')),
      verification_method TEXT DEFAULT 'Face + Geolocation',
      confidence_score REAL,
      liveness_verified INTEGER DEFAULT 1,
      location_verified INTEGER DEFAULT 1,
      latitude REAL,
      longitude REAL,
      distance_from_hostel_meters REAL,
      verification_signals TEXT,
      failure_reason TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      verified_by_user_id TEXT
    );

    -- Leave Requests
    CREATE TABLE IF NOT EXISTS leave_requests (
      id TEXT PRIMARY KEY,
      student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
      leave_type TEXT NOT NULL CHECK(leave_type IN ('Outing', 'Night Out', 'Home Leave', 'Emergency/Medical', 'Academic Visit')),
      reason TEXT NOT NULL,
      destination TEXT NOT NULL,
      departure_date TEXT NOT NULL,
      expected_return_date TEXT NOT NULL,
      status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Rejected', 'Cancelled', 'Expired')),
      parent_informed INTEGER DEFAULT 1,
      parent_consent_phone TEXT,
      warden_remarks TEXT,
      reviewed_by_user_id TEXT REFERENCES users(id),
      reviewed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Movement Records
    CREATE TABLE IF NOT EXISTS movement_records (
      id TEXT PRIMARY KEY,
      student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
      leave_request_id TEXT REFERENCES leave_requests(id) ON DELETE SET NULL,
      movement_type TEXT NOT NULL,
      status TEXT DEFAULT 'Outside' CHECK(status IN ('Outside', 'Returned', 'Overdue')),
      actual_departure_time TEXT NOT NULL,
      expected_return_time TEXT NOT NULL,
      actual_return_time TEXT,
      departure_gate TEXT DEFAULT 'Main Campus Gate A',
      return_gate TEXT,
      return_verification_method TEXT,
      return_location_lat REAL,
      return_location_lng REAL,
      return_notes TEXT,
      is_overdue INTEGER DEFAULT 0,
      overdue_minutes INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Exception Alerts
    CREATE TABLE IF NOT EXISTS exception_alerts (
      id TEXT PRIMARY KEY,
      student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('Critical', 'High', 'Medium', 'Low')),
      status TEXT DEFAULT 'Open' CHECK(status IN ('Open', 'Acknowledged', 'Resolved', 'Dismissed')),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      resolution_notes TEXT,
      resolved_by_user_id TEXT REFERENCES users(id),
      resolved_at TEXT,
      acknowledged_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      details TEXT,
      ip_address TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- System Settings
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_students_roll ON students(roll_number);
    CREATE INDEX IF NOT EXISTS idx_students_status ON students(current_status);
    CREATE INDEX IF NOT EXISTS idx_students_room ON students(room_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);
    CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(student_id);
    CREATE INDEX IF NOT EXISTS idx_leave_student ON leave_requests(student_id);
    CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);
    CREATE INDEX IF NOT EXISTS idx_movement_student ON movement_records(student_id);
    CREATE INDEX IF NOT EXISTS idx_movement_status ON movement_records(status);
    CREATE INDEX IF NOT EXISTS idx_exceptions_status ON exception_alerts(status);
    CREATE INDEX IF NOT EXISTS idx_exceptions_student ON exception_alerts(student_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
  `);

  // Initialize default system settings if missing
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO system_settings (key, value, description)
    VALUES (?, ?, ?)
  `);

  insertSetting.run('hostel_name', 'Tagore Central Hostel Complex', 'Full name of the hostel premises');
  insertSetting.run('hostel_lat', '15.774299', 'Hostel Campus Central Latitude');
  insertSetting.run('hostel_lng', '78.054718', 'Hostel Campus Central Longitude');
  insertSetting.run('geofence_radius_meters', '35', 'Acceptable radius in meters for on-campus verification');
  insertSetting.run('geofence_polygon', JSON.stringify([
    { id: 'q1', lat: 15.774450196357801, lng: 78.05467113649686 },
    { id: 'q2', lat: 15.774311503975998, lng: 78.05457367411404 },
    { id: 'q3', lat: 15.774131902250424, lng: 78.0547841514271 },
    { id: 'q4', lat: 15.774300528319552, lng: 78.05484117730008 }
  ]), 'Exact 4-corner boundary coordinates (q1, q2, q3, q4)');
  insertSetting.run('attendance_curfew_time', '21:30', 'Daily attendance cutoff time (24h format HH:MM)');
  insertSetting.run('overdue_grace_minutes', '15', 'Grace minutes before an overdue exception is generated');
  insertSetting.run('face_match_threshold', '0.70', 'Minimum cosine similarity score required for face match');
  insertSetting.run('liveness_check_enabled', '1', 'Enforce anti-spoofing and liveness validation');
  insertSetting.run('demo_mode_active', '1', 'Indicates seeded realistic 1,200 student operational dataset');

  // Automatically guarantee campus architecture (Hostels, Blocks, Floors, 300 Rooms, Staff)
  ensureCampusInfrastructure();
  applyAuthoritativeGeofence();
  updateAuthoritativeBlockNames();

  console.log('Database initialized successfully with complete normalized schema and room infrastructure.');
}

export function updateAuthoritativeBlockNames() {
  const blocks = [
    { id: 'block-a', name: 'Block A - Annapurna', code: 'BLK-A' },
    { id: 'block-b', name: 'Block B - Arundhati', code: 'BLK-B' },
    { id: 'block-c', name: 'Block C - Anuradha', code: 'BLK-C' }
  ];

  try {
    for (const b of blocks) {
      db.prepare(`UPDATE blocks SET name = ?, code = ? WHERE id = ?`).run(b.name, b.code, b.id);
      safePgQuery(`UPDATE blocks SET name = $1, code = $2 WHERE id = $3`, [b.name, b.code, b.id]);
    }
  } catch (err: any) {
    console.warn('[DB Block Update Note]', err.message);
  }
}

export function applyAuthoritativeGeofence() {
  const centroidLat = 15.774299;
  const centroidLng = 78.054718;
  const radiusMeters = 35;
  const polygonStr = JSON.stringify([
    { id: 'q1', lat: 15.774450196357801, lng: 78.05467113649686 },
    { id: 'q2', lat: 15.774311503975998, lng: 78.05457367411404 },
    { id: 'q3', lat: 15.774131902250424, lng: 78.0547841514271 },
    { id: 'q4', lat: 15.774300528319552, lng: 78.05484117730008 }
  ]);

  try {
    db.prepare(`
      UPDATE hostels
      SET latitude = ?, longitude = ?, geofence_radius_meters = ?
      WHERE id = 'hostel-tagore-main'
    `).run(centroidLat, centroidLng, radiusMeters);

    const setStmt = db.prepare(`
      INSERT INTO system_settings (key, value, description, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `);

    setStmt.run('hostel_lat', String(centroidLat), 'Hostel Campus Central Latitude');
    setStmt.run('hostel_lng', String(centroidLng), 'Hostel Campus Central Longitude');
    setStmt.run('geofence_radius_meters', String(radiusMeters), 'Acceptable radius in meters for on-campus verification');
    setStmt.run('geofence_polygon', polygonStr, 'Exact 4-corner boundary coordinates (q1, q2, q3, q4)');
  } catch (err: any) {
    console.warn('[DB Geofence Note]', err.message);
  }
}

export function ensureCampusInfrastructure() {
  const roomRow = db.prepare('SELECT count(*) as count FROM rooms').get() as any;
  if (roomRow && roomRow.count > 0) {
    return; // Rooms already provisioned
  }

  console.log('[Campus Init] Empty room architecture detected. Auto-provisioning hostel, blocks, floors and 300 rooms...');

  const hostelId = 'hostel-tagore-main';
  db.prepare(`
    INSERT OR IGNORE INTO hostels (id, name, code, address, latitude, longitude, geofence_radius_meters)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    hostelId,
    'Tagore Central Hostel Complex',
    'TCHC-01',
    'Campus North Wing, Knowledge Park, Academic City',
    15.774299,
    78.054718,
    35
  );

  const blocksData = [
    { id: 'block-a', name: 'Block A - Annapurna', code: 'BLK-A', gender: 'Co-ed' },
    { id: 'block-b', name: 'Block B - Arundhati', code: 'BLK-B', gender: 'Co-ed' },
    { id: 'block-c', name: 'Block C - Anuradha', code: 'BLK-C', gender: 'Co-ed' }
  ];

  const insertBlock = db.prepare(`
    INSERT OR IGNORE INTO blocks (id, hostel_id, name, code, gender, total_floors)
    VALUES (?, ?, ?, ?, ?, 4)
  `);

  const insertFloor = db.prepare(`
    INSERT OR IGNORE INTO floors (id, block_id, floor_number, name)
    VALUES (?, ?, ?, ?)
  `);

  const insertRoom = db.prepare(`
    INSERT OR IGNORE INTO rooms (id, floor_id, block_id, room_number, capacity, occupied_count, status)
    VALUES (?, ?, ?, ?, 4, 0, 'Available')
  `);

  db.transaction(() => {
    for (const b of blocksData) {
      insertBlock.run(b.id, hostelId, b.name, b.code, b.gender);

      for (let f = 1; f <= 4; f++) {
        const floorId = `floor-${b.id}-${f}`;
        const floorName = f === 1 ? 'Ground Floor' : `${f - 1}${f === 2 ? 'st' : f === 3 ? 'nd' : 'rd'} Floor`;
        insertFloor.run(floorId, b.id, f, floorName);

        for (let r = 1; r <= 25; r++) {
          const roomNum = `${b.code.slice(-1)}-${f * 100 + r}`;
          const roomId = `room-${b.id}-${f * 100 + r}`;
          insertRoom.run(roomId, floorId, b.id, roomNum);
        }
      }
    }

    // Provision core staff credentials (admin / admin123, warden / warden123, guard / guard123)
    const salt = bcrypt.genSaltSync(10);
    const adminHash = bcrypt.hashSync('admin123', salt);
    const wardenHash = bcrypt.hashSync('warden123', salt);
    const guardHash = bcrypt.hashSync('guard123', salt);

    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (id, username, email, password_hash, role, full_name, phone, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
    `);

    insertUser.run('usr-admin-01', 'admin', 'admin@hostelsafety.edu', adminHash, 'admin', 'Col. Sanjeev Deshmukh (Chief Administrator)', '+91 98110 22334');
    insertUser.run('usr-warden-01', 'warden', 'warden@hostelsafety.edu', wardenHash, 'warden', 'Dr. Rajesh Verma (Chief Warden)', '+91 98220 44556');
    insertUser.run('usr-guard-01', 'guard', 'security@hostelsafety.edu', guardHash, 'warden', 'Main Gate Security Desk', '+91 98330 11223');
  })();

  console.log('[Campus Init] 1 Hostel, 3 Blocks, 12 Floors, 300 Rooms, and Core Staff successfully auto-provisioned.');
}

// Immediately apply authoritative 4-corner coordinates on database load
applyAuthoritativeGeofence();
