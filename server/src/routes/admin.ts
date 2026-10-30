import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { safePgQuery } from '../postgres.js';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth.js';
import { runExceptionDetectionJob } from '../services/exceptionEngine.js';
import { detectFaceBiometrics } from '../utils/faceClient.js';

export const adminRouter = Router();

adminRouter.use(authenticateToken);
adminRouter.use(requireRole(['admin']));

// 1. Get System Settings
adminRouter.get('/settings', (req: AuthenticatedRequest, res) => {
  const rows = db.prepare('SELECT * FROM system_settings').all() as any[];
  const settings: Record<string, string> = {};
  for (const r of rows) {
    settings[r.key] = r.value;
  }
  res.json({ settings, list: rows });
});

// Update System Settings
adminRouter.post('/settings', (req: AuthenticatedRequest, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Settings object required' });
  }

  const updateStmt = db.prepare(`
    INSERT INTO system_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);

  for (const [key, value] of Object.entries(settings)) {
    updateStmt.run(key, String(value));
  }

  // If geofence or coords changed, update hostel table
  if (settings.hostel_lat && settings.hostel_lng && settings.geofence_radius_meters) {
    db.prepare(`
      UPDATE hostels
      SET latitude = ?, longitude = ?, geofence_radius_meters = ?
      WHERE id = 'hostel-tagore-main'
    `).run(Number(settings.hostel_lat), Number(settings.hostel_lng), Number(settings.geofence_radius_meters));
  }

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details)
    VALUES (?, ?, 'UPDATE_SETTINGS', 'system_settings', 'all', ?)
  `).run(
    `aud-${Date.now()}`,
    req.user!.id,
    `Admin updated system parameters: ${Object.keys(settings).join(', ')}`
  );

  res.json({ success: true, message: 'System settings updated successfully.' });
});

// 2. User & Role Management
adminRouter.get('/users', (req: AuthenticatedRequest, res) => {
  const { role, search, page = '1', limit = '20' } = req.query as any;

  let query = `SELECT id, username, email, role, full_name, phone, status, created_at, last_login FROM users WHERE 1=1`;
  const params: any[] = [];

  if (role && role !== 'All') {
    query += ` AND role = ?`;
    params.push(role);
  }

  if (search) {
    query += ` AND (full_name LIKE ? OR username LIKE ? OR email LIKE ?)`;
    const p = `%${search}%`;
    params.push(p, p, p);
  }

  query += ` ORDER BY created_at DESC`;

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  query += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit, 10), offset);

  const users = db.prepare(query).all(...params);

  res.json({ users });
});

// Create User (Warden or Admin)
adminRouter.post('/users', (req: AuthenticatedRequest, res) => {
  const { username, email, password, role, full_name, phone } = req.body;

  if (!username || !email || !password || !role || !full_name) {
    return res.status(400).json({ error: 'Username, email, password, role and full name are required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) {
    return res.status(400).json({ error: 'Username or email already in use' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const userId = `usr-${Date.now()}`;

  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, role, full_name, phone, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
  `).run(userId, username, email, hash, role, full_name, phone || null);

  safePgQuery(`
    INSERT INTO users (id, username, email, password_hash, role, full_name, phone, status, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active', NOW())
    ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, full_name = EXCLUDED.full_name
  `, [userId, username, email, hash, role, full_name, phone || null]);

  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details)
    VALUES (?, ?, 'CREATE_USER', 'users', ?, ?)
  `).run(`aud-${Date.now()}`, req.user!.id, userId, `Created user ${username} with role ${role}`);

  res.json({ success: true, message: `User ${username} created successfully`, userId });
});

// 3. Register New Student
adminRouter.post('/students', (req: AuthenticatedRequest, res) => {
  const {
    roll_number,
    full_name,
    email,
    phone,
    emergency_phone,
    parent_name,
    parent_phone,
    room_id,
    department,
    year_of_study
  } = req.body;

  if (!roll_number || !full_name || !email || !phone || !room_id) {
    return res.status(400).json({ error: 'Roll number, name, email, phone and room assignment are required' });
  }

  const existingRoll = db.prepare('SELECT id FROM students WHERE roll_number = ?').get(roll_number);
  if (existingRoll) {
    return res.status(400).json({ error: `Roll number ${roll_number} is already registered` });
  }

  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(room_id) as any;
  if (!room) {
    return res.status(404).json({ error: 'Assigned room does not exist' });
  }

  const studentId = `std-${Date.now()}`;
  const userId = `usr-${Date.now()}`;
  const defaultPasswordHash = bcrypt.hashSync('student123', 10);

  // Create user
  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, role, full_name, phone, status)
    VALUES (?, ?, ?, ?, 'student', ?, ?, 'Active')
  `).run(userId, roll_number.toLowerCase(), email, defaultPasswordHash, full_name, phone);

  safePgQuery(`
    INSERT INTO users (id, username, email, password_hash, role, full_name, phone, status, created_at)
    VALUES ($1, $2, $3, $4, 'student', $5, $6, 'Active', NOW())
    ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, full_name = EXCLUDED.full_name
  `, [userId, roll_number.toLowerCase(), email, defaultPasswordHash, full_name, phone]);

  // Create student
  db.prepare(`
    INSERT INTO students (
      id, user_id, roll_number, full_name, email, phone, emergency_phone,
      parent_name, parent_phone, hostel_id, block_id, floor_id, room_id,
      room_number, department, year_of_study, current_status, has_face_enrolled
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, 'hostel-tagore-main', ?, ?, ?,
      ?, ?, ?, 'Inside', 0
    )
  `).run(
    studentId,
    userId,
    roll_number,
    full_name,
    email,
    phone,
    emergency_phone || phone,
    parent_name || 'Guardian',
    parent_phone || phone,
    room.block_id,
    room.floor_id,
    room.id,
    room.room_number,
    department || 'Engineering',
    year_of_study || 1
  );

  safePgQuery(`
    INSERT INTO students (
      id, user_id, roll_number, full_name, email, phone, emergency_phone,
      parent_name, parent_phone, hostel_id, block_id, floor_id, room_id,
      room_number, department, year_of_study, current_status, has_face_enrolled,
      created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, 'hostel-tagore-main', $10, $11, $12,
      $13, $14, $15, 'Inside', 0,
      NOW()
    )
    ON CONFLICT (id) DO NOTHING
  `, [
    studentId,
    userId,
    roll_number,
    full_name,
    email,
    phone,
    emergency_phone || phone,
    parent_name || 'Guardian',
    parent_phone || phone,
    room.block_id,
    room.floor_id,
    room.id,
    room.room_number,
    department || 'Engineering',
    year_of_study || 1
  ]);

  // Update room count
  db.prepare(`
    UPDATE rooms
    SET occupied_count = occupied_count + 1
    WHERE id = ?
  `).run(room.id);

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details)
    VALUES (?, ?, 'REGISTER_STUDENT', 'students', ?, ?)
  `).run(
    `aud-${Date.now()}`,
    req.user!.id,
    studentId,
    `Registered new student ${full_name} (${roll_number}) in Room ${room.room_number}`
  );

  res.json({
    success: true,
    message: `Student ${full_name} registered successfully. Default password is 'student123'.`,
    studentId
  });
});

// 4. Enroll / Re-enroll Biometric Face Descriptor (Accepts base64 frame or vector)
adminRouter.post('/students/:id/face-enroll', async (req: AuthenticatedRequest, res) => {
  try {
    const { face_descriptor, imageBase64 } = req.body;
    const studentId = req.params.id;

    let finalDescriptor: number[] | null = face_descriptor || null;

    if (!finalDescriptor && imageBase64) {
      // Call OpenCV FastAPI to detect face and compute 32-bin vector
      const detectResult = await detectFaceBiometrics(imageBase64);
      if (detectResult.detected && detectResult.descriptor) {
        finalDescriptor = detectResult.descriptor;
      } else {
        return res.status(422).json({
          error: 'No Face Detected',
          message: detectResult.message || 'No clear face detected in the camera frame.'
        });
      }
    }

    if (!finalDescriptor) {
      return res.status(400).json({ error: 'Biometric face descriptor vector or camera frame required' });
    }

    const descriptorStr = typeof finalDescriptor === 'string' ? finalDescriptor : JSON.stringify(finalDescriptor);

    db.prepare(`
      UPDATE students
      SET face_descriptor = ?,
          has_face_enrolled = 1,
          face_enrolled_at = datetime('now')
      WHERE id = ?
    `).run(descriptorStr, studentId);

    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details)
      VALUES (?, ?, 'ENROLL_FACE_BIOMETRIC', 'students', ?, ?)
    `).run(`aud-${Date.now()}`, req.user!.id, studentId, `Warden/Admin enrolled real face template for student ${studentId}`);

    res.json({ success: true, message: 'Face biometric template enrolled successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Face enrollment failed' });
  }
});

// Clear Demo Data (Leaves hostel architecture and staff accounts intact)
adminRouter.post('/clear-demo-students', (req: AuthenticatedRequest, res) => {
  try {
    // 1. Find demo user IDs
    const demoStudents = db.prepare(`
      SELECT id, user_id FROM students
      WHERE id LIKE 'std-0%' OR roll_number LIKE '2024CS%'
    `).all() as any[];

    const studentIds = demoStudents.map((s) => s.id);
    const userIds = demoStudents.map((s) => s.user_id).filter(Boolean);

    // 2. Delete related attendance and movements
    if (studentIds.length > 0) {
      const placeholders = studentIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM attendance_records WHERE student_id IN (${placeholders})`).run(...studentIds);
      db.prepare(`DELETE FROM movement_records WHERE student_id IN (${placeholders})`).run(...studentIds);
      db.prepare(`DELETE FROM leave_requests WHERE student_id IN (${placeholders})`).run(...studentIds);
      db.prepare(`DELETE FROM exception_alerts WHERE student_id IN (${placeholders})`).run(...studentIds);
      db.prepare(`DELETE FROM notifications WHERE student_id IN (${placeholders})`).run(...studentIds);
      db.prepare(`DELETE FROM students WHERE id IN (${placeholders})`).run(...studentIds);
    }

    if (userIds.length > 0) {
      const uPlaceholders = userIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM users WHERE id IN (${uPlaceholders})`).run(...userIds);
    }

    // 3. Recalculate room occupancy counts
    db.prepare(`
      UPDATE rooms
      SET occupied_count = (SELECT COUNT(*) FROM students WHERE room_id = rooms.id)
    `).run();

    const remainingStudents = db.prepare('SELECT COUNT(*) as count FROM students').get() as any;

    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details)
      VALUES (?, ?, 'CLEAR_DEMO_DATA', 'system', 'all', ?)
    `).run(`aud-${Date.now()}`, req.user!.id, `Removed ${studentIds.length} synthetic demo students.`);

    res.json({
      success: true,
      message: `Successfully cleared ${studentIds.length} demo student records. Remaining real students: ${remainingStudents.count}.`,
      clearedCount: studentIds.length,
      remainingRealStudents: remainingStudents.count
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to clear demo data' });
  }
});

// Delete a single student by ID (Admin only)
adminRouter.delete('/students/:studentId', (req: AuthenticatedRequest, res) => {
  const { studentId } = req.params;
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  try {
    const student = db.prepare('SELECT id, user_id FROM students WHERE id = ?').get(studentId) as any;
    if (!student) {
      return res.status(404).json({ error: 'Student not found.' });
    }

    db.prepare('DELETE FROM attendance_records WHERE student_id = ?').run(studentId);
    db.prepare('DELETE FROM movement_records WHERE student_id = ?').run(studentId);
    db.prepare('DELETE FROM leave_requests WHERE student_id = ?').run(studentId);
    db.prepare('DELETE FROM exception_alerts WHERE student_id = ?').run(studentId);
    db.prepare('DELETE FROM notifications WHERE student_id = ?').run(studentId);
    db.prepare('DELETE FROM students WHERE id = ?').run(studentId);
    if (student.user_id) {
      db.prepare('DELETE FROM users WHERE id = ?').run(student.user_id);
    }
    db.prepare(`UPDATE rooms SET occupied_count = (SELECT COUNT(*) FROM students WHERE room_id = rooms.id)`).run();

    db.prepare(`INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details) VALUES (?, ?, 'DELETE_STUDENT', 'student', ?, ?)`)
      .run(`aud-${Date.now()}`, req.user!.id, studentId, `Admin deleted student ${studentId}`);

    res.json({ success: true, message: 'Student deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete student' });
  }
});

// 5. Audit Logs
adminRouter.get('/audit-logs', (req: AuthenticatedRequest, res) => {
  const { limit = '50' } = req.query as any;

  const logs = db.prepare(`
    SELECT a.*, u.full_name as user_full_name, u.role as user_role
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.timestamp DESC
    LIMIT ?
  `).all(parseInt(limit, 10));

  res.json({ logs });
});

// 6. Manual trigger for Exception Detection
adminRouter.post('/run-exception-checks', (req: AuthenticatedRequest, res) => {
  const results = runExceptionDetectionJob();
  res.json({
    success: true,
    message: 'Exception detection cycle executed.',
    results
  });
});
