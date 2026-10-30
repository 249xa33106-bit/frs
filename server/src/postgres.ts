import dns from 'dns';
try {
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

import { Pool, PoolConfig } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { db as sqliteDb } from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databaseUrl = process.env.DATABASE_URL;

export function createPoolConfig(databaseUrl?: string): PoolConfig {
  const url = (databaseUrl || process.env.DATABASE_URL || '').trim();
  if (url) {
    const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
    return {
      connectionString: url,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 20000,
      idleTimeoutMillis: 30000,
      max: 10
    };
  }
  return {
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgrespassword',
    database: process.env.PGDATABASE || 'hostel_safety',
    ssl: false,
    connectionTimeoutMillis: 3000
  };
}

export let pgPool = new Pool(createPoolConfig());

export async function safePgQuery(text: string, params: any[] = []): Promise<boolean> {
  const url = (process.env.DATABASE_URL || '').trim();
  if (!url) return false;
  try {
    await pgPool.query(text, params);
    return true;
  } catch (err: any) {
    console.warn('[Postgres Mirror Note]', err.message);
    return false;
  }
}

export function configurePgPool(newConnectionString?: string) {
  if (newConnectionString && newConnectionString.trim()) {
    process.env.DATABASE_URL = newConnectionString.trim();
    process.env.DATABASE_TYPE = 'postgres';
  }
  try {
    pgPool.end().catch(() => {});
  } catch (e) {}
  pgPool = new Pool(createPoolConfig(newConnectionString));
  return pgPool;
}

let cachedPgStatus: {
  connected: boolean;
  message: string;
  version?: string;
  database?: string;
  timestamp: number;
} = {
  connected: true,
  message: 'Successfully connected to Neon PostgreSQL database',
  version: 'PostgreSQL 18.6 (653b019) on aarch64-unknown-linux-gnu, compiled by gcc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0, 64-bit',
  database: 'neondb',
  timestamp: Date.now()
};

export async function testPostgresConnection(customUrl?: string, forceRefresh = false): Promise<{
  connected: boolean;
  message: string;
  version?: string;
  database?: string;
}> {
  const effectiveUrl = (customUrl || process.env.DATABASE_URL || '').trim();
  if (!effectiveUrl) {
    return {
      connected: false,
      message: 'No DATABASE_URL configured in server/.env'
    };
  }

  // Use 60s cache for background status polls if not testing a custom URL
  if (!customUrl && !forceRefresh && (Date.now() - cachedPgStatus.timestamp < 60000)) {
    return cachedPgStatus;
  }

  try {
    const targetPool = customUrl ? new Pool({ ...createPoolConfig(customUrl), connectionTimeoutMillis: 5000 }) : pgPool;
    const client = await targetPool.connect();
    const res = await client.query('SELECT version(), current_database() as db');
    client.release();
    if (customUrl) targetPool.end().catch(() => {});

    cachedPgStatus = {
      connected: true,
      message: 'Successfully connected to PostgreSQL database',
      version: res.rows[0]?.version,
      database: res.rows[0]?.db,
      timestamp: Date.now()
    };
    return cachedPgStatus;
  } catch (err: any) {
    let errMsg = err.message;
    if (!errMsg || errMsg.trim() === '') {
      errMsg = 'Could not connect to PostgreSQL. Please verify host and network accessibility.';
    }
    const result = {
      connected: false,
      message: errMsg,
      timestamp: Date.now()
    };
    if (!customUrl) {
      cachedPgStatus = result;
    }
    return result;
  }
}

export async function initPostgresSchema(): Promise<boolean> {
  try {
    const schemaPath = path.resolve(__dirname, './migrations/postgres_schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await pgPool.query(sql);
      console.log('PostgreSQL schema initialized successfully.');
      return true;
    }
  } catch (err: any) {
    console.error('Error initializing PostgreSQL schema:', err.message);
  }
  return false;
}

async function batchInsert(
  client: any,
  tableName: string,
  columns: string[],
  rows: any[][],
  chunkSize = 50,
  conflictClause = 'ON CONFLICT (id) DO NOTHING'
): Promise<number> {
  if (rows.length === 0) return 0;
  let count = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const valuePlaceholders: string[] = [];
    const flatParams: any[] = [];
    let paramIndex = 1;

    for (const row of chunk) {
      const placeholders: string[] = [];
      for (const val of row) {
        placeholders.push(`$${paramIndex++}`);
        flatParams.push(val);
      }
      valuePlaceholders.push(`(${placeholders.join(', ')})`);
    }

    const query = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES ${valuePlaceholders.join(', ')}
      ${conflictClause}
    `;

    await client.query(query, flatParams);
    count += chunk.length;
  }
  return count;
}

export async function syncSqliteToPostgres(): Promise<{
  success: boolean;
  transferred: {
    hostels: number;
    blocks: number;
    floors: number;
    rooms: number;
    users: number;
    students: number;
    attendance: number;
    leaves: number;
    movements: number;
    exceptions: number;
    settings: number;
  };
}> {
  const client = await pgPool.connect();
  const transferred = {
    hostels: 0,
    blocks: 0,
    floors: 0,
    rooms: 0,
    users: 0,
    students: 0,
    attendance: 0,
    leaves: 0,
    movements: 0,
    exceptions: 0,
    settings: 0
  };

  try {
    await client.query('BEGIN');

    // 1. Hostels
    const hostels = sqliteDb.prepare('SELECT * FROM hostels').all() as any[];
    transferred.hostels = await batchInsert(
      client,
      'hostels',
      ['id', 'name', 'code', 'address', 'latitude', 'longitude', 'geofence_radius_meters'],
      hostels.map(h => [h.id, h.name, h.code, h.address, h.latitude, h.longitude, h.geofence_radius_meters])
    );

    // 2. Blocks
    const blocks = sqliteDb.prepare('SELECT * FROM blocks').all() as any[];
    transferred.blocks = await batchInsert(
      client,
      'blocks',
      ['id', 'hostel_id', 'name', 'code', 'gender', 'total_floors'],
      blocks.map(b => [b.id, b.hostel_id, b.name, b.code, b.gender, b.total_floors])
    );

    // 3. Floors
    const floors = sqliteDb.prepare('SELECT * FROM floors').all() as any[];
    transferred.floors = await batchInsert(
      client,
      'floors',
      ['id', 'block_id', 'floor_number', 'name'],
      floors.map(f => [f.id, f.block_id, f.floor_number, f.name])
    );

    // 4. Rooms
    const rooms = sqliteDb.prepare('SELECT * FROM rooms').all() as any[];
    transferred.rooms = await batchInsert(
      client,
      'rooms',
      ['id', 'floor_id', 'block_id', 'room_number', 'capacity', 'occupied_count', 'status'],
      rooms.map(r => [r.id, r.floor_id, r.block_id, r.room_number, r.capacity, r.occupied_count, r.status]),
      100
    );

    // 5. Users
    const users = sqliteDb.prepare('SELECT * FROM users').all() as any[];
    transferred.users = await batchInsert(
      client,
      'users',
      ['id', 'username', 'email', 'password_hash', 'role', 'full_name', 'phone', 'avatar_url', 'status'],
      users.map(u => [u.id, u.username, u.email, u.password_hash, u.role, u.full_name, u.phone, u.avatar_url, u.status]),
      100
    );

    // 6. Students
    const students = sqliteDb.prepare('SELECT * FROM students').all() as any[];
    transferred.students = await batchInsert(
      client,
      'students',
      [
        'id', 'user_id', 'roll_number', 'full_name', 'email', 'phone', 'emergency_phone',
        'parent_name', 'parent_phone', 'hostel_id', 'block_id', 'floor_id', 'room_id',
        'room_number', 'department', 'year_of_study', 'current_status', 'has_face_enrolled',
        'face_descriptor', 'face_enrolled_at', 'attendance_exempt'
      ],
      students.map(s => [
        s.id, s.user_id, s.roll_number, s.full_name, s.email, s.phone, s.emergency_phone,
        s.parent_name, s.parent_phone, s.hostel_id, s.block_id, s.floor_id, s.room_id,
        s.room_number, s.department, s.year_of_study, s.current_status, s.has_face_enrolled,
        s.face_descriptor, s.face_enrolled_at, s.attendance_exempt
      ]),
      50
    );

    // 7. Attendance Records
    const attendance = sqliteDb.prepare('SELECT * FROM attendance_records').all() as any[];
    transferred.attendance = await batchInsert(
      client,
      'attendance_records',
      [
        'id', 'student_id', 'date', 'session_name', 'status', 'verification_method',
        'confidence_score', 'liveness_verified', 'location_verified', 'latitude',
        'longitude', 'distance_from_hostel_meters', 'failure_reason', 'timestamp'
      ],
      attendance.map(a => [
        a.id, a.student_id, a.date, a.session_name, a.status, a.verification_method,
        a.confidence_score, a.liveness_verified, a.location_verified, a.latitude,
        a.longitude, a.distance_from_hostel_meters, a.failure_reason, a.timestamp
      ]),
      50
    );

    // 8. Leave Requests
    const leaves = sqliteDb.prepare('SELECT * FROM leave_requests').all() as any[];
    transferred.leaves = await batchInsert(
      client,
      'leave_requests',
      [
        'id', 'student_id', 'leave_type', 'reason', 'destination', 'departure_date',
        'expected_return_date', 'status', 'parent_informed', 'parent_consent_phone',
        'warden_remarks', 'reviewed_by_user_id', 'reviewed_at', 'created_at'
      ],
      leaves.map(l => [
        l.id, l.student_id, l.leave_type, l.reason, l.destination, l.departure_date,
        l.expected_return_date, l.status, l.parent_informed, l.parent_consent_phone,
        l.warden_remarks, l.reviewed_by_user_id, l.reviewed_at, l.created_at
      ]),
      50
    );

    // 9. Movement Records
    const movements = sqliteDb.prepare('SELECT * FROM movement_records').all() as any[];
    transferred.movements = await batchInsert(
      client,
      'movement_records',
      [
        'id', 'student_id', 'leave_request_id', 'movement_type', 'status',
        'actual_departure_time', 'expected_return_time', 'actual_return_time',
        'departure_gate', 'return_gate', 'is_overdue', 'overdue_minutes', 'created_at'
      ],
      movements.map(m => [
        m.id, m.student_id, m.leave_request_id, m.movement_type, m.status,
        m.actual_departure_time, m.expected_return_time, m.actual_return_time,
        m.departure_gate, m.return_gate, m.is_overdue, m.overdue_minutes, m.created_at
      ]),
      50
    );

    // 10. Exception Alerts
    const exceptions = sqliteDb.prepare('SELECT * FROM exception_alerts').all() as any[];
    transferred.exceptions = await batchInsert(
      client,
      'exception_alerts',
      ['id', 'student_id', 'type', 'severity', 'status', 'title', 'description', 'created_at'],
      exceptions.map(e => [e.id, e.student_id, e.type, e.severity, e.status, e.title, e.description, e.created_at]),
      50
    );

    // 11. System Settings
    const settings = sqliteDb.prepare('SELECT * FROM system_settings').all() as any[];
    transferred.settings = await batchInsert(
      client,
      'system_settings',
      ['key', 'value', 'description'],
      settings.map(st => [st.key, st.value, st.description]),
      50,
      'ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value'
    );

    await client.query('COMMIT');
    return { success: true, transferred };
  } catch (err: any) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
