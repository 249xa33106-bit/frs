import { Router } from 'express';
import { db, ensureCampusInfrastructure } from '../db.js';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth.js';

export const hostelRouter = Router();

hostelRouter.use(authenticateToken);
hostelRouter.use(requireRole(['warden', 'admin']));

// 1. Hierarchy Tree / Explorer: Hostel -> Blocks -> Floors -> Rooms
hostelRouter.get('/hierarchy', (req: AuthenticatedRequest, res) => {
  let hostels = db.prepare('SELECT * FROM hostels').all() as any[];
  if (hostels.length === 0) {
    ensureCampusInfrastructure();
    hostels = db.prepare('SELECT * FROM hostels').all() as any[];
  }
  const blocks = db.prepare('SELECT * FROM blocks').all() as any[];
  const floors = db.prepare('SELECT * FROM floors ORDER BY floor_number ASC').all() as any[];
  
  // Get all rooms with current student count & occupant statuses
  const rooms = db.prepare(`
    SELECT r.*,
           (SELECT count(*) FROM students s WHERE s.room_id = r.id) as student_count,
           (SELECT count(*) FROM students s WHERE s.room_id = r.id AND s.current_status = 'Inside') as inside_count,
           (SELECT count(*) FROM students s WHERE s.room_id = r.id AND s.current_status = 'Outside') as outside_count,
           (SELECT count(*) FROM students s WHERE s.room_id = r.id AND s.current_status = 'On Leave') as leave_count
    FROM rooms r
    ORDER BY r.room_number ASC
  `).all() as any[];

  res.json({
    hostels,
    blocks,
    floors,
    rooms
  });
});

// 2. Room Explorer: Get specific room details with occupants
hostelRouter.get('/rooms/:id', (req: AuthenticatedRequest, res) => {
  const room = db.prepare(`
    SELECT r.*, b.name as block_name, f.name as floor_name, h.name as hostel_name
    FROM rooms r
    JOIN blocks b ON r.block_id = b.id
    JOIN floors f ON r.floor_id = f.id
    JOIN hostels h ON b.hostel_id = h.id
    WHERE r.id = ?
  `).get(req.params.id) as any;

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  // Fetch all students residing in this room
  const students = db.prepare(`
    SELECT s.*,
           (SELECT status FROM attendance_records a WHERE a.student_id = s.id AND a.date = date('now') ORDER BY timestamp DESC LIMIT 1) as today_attendance
    FROM students s
    WHERE s.room_id = ?
    ORDER BY s.roll_number ASC
  `).all(req.params.id);

  res.json({ room, students });
});

// 3. Student Search with comprehensive filtering
hostelRouter.get('/students', (req: AuthenticatedRequest, res) => {
  const {
    search,
    block_id,
    floor_id,
    room_number,
    status,
    department,
    page = '1',
    limit = '20'
  } = req.query as any;

  let query = `
    SELECT s.*, b.name as block_name, f.name as floor_name,
           (SELECT status FROM attendance_records a WHERE a.student_id = s.id AND a.date = date('now') ORDER BY timestamp DESC LIMIT 1) as today_attendance,
           (SELECT count(*) FROM exception_alerts e WHERE e.student_id = s.id AND e.status IN ('Open', 'Acknowledged')) as open_exceptions_count
    FROM students s
    LEFT JOIN blocks b ON s.block_id = b.id
    LEFT JOIN floors f ON s.floor_id = f.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (search) {
    query += ` AND (s.full_name LIKE ? OR s.roll_number LIKE ? OR s.room_number LIKE ? OR s.phone LIKE ?)`;
    const p = `%${search}%`;
    params.push(p, p, p, p);
  }

  if (block_id && block_id !== 'All') {
    query += ` AND s.block_id = ?`;
    params.push(block_id);
  }

  if (floor_id && floor_id !== 'All') {
    query += ` AND s.floor_id = ?`;
    params.push(floor_id);
  }

  if (room_number) {
    query += ` AND s.room_number LIKE ?`;
    params.push(`%${room_number}%`);
  }

  if (status && status !== 'All') {
    query += ` AND s.current_status = ?`;
    params.push(status);
  }

  if (department && department !== 'All') {
    query += ` AND s.department = ?`;
    params.push(department);
  }

  query += ` ORDER BY s.created_at DESC, s.rowid DESC`;

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  query += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit, 10), offset);

  const students = db.prepare(query).all(...params);

  // Total count query
  let countQuery = `SELECT count(*) as count FROM students s WHERE 1=1`;
  const countParams: any[] = [];
  if (search) {
    countQuery += ` AND (s.full_name LIKE ? OR s.roll_number LIKE ? OR s.room_number LIKE ? OR s.phone LIKE ?)`;
    const p = `%${search}%`;
    countParams.push(p, p, p, p);
  }
  if (block_id && block_id !== 'All') {
    countQuery += ` AND s.block_id = ?`;
    countParams.push(block_id);
  }
  if (floor_id && floor_id !== 'All') {
    countQuery += ` AND s.floor_id = ?`;
    countParams.push(floor_id);
  }
  if (room_number) {
    countQuery += ` AND s.room_number LIKE ?`;
    countParams.push(`%${room_number}%`);
  }
  if (status && status !== 'All') {
    countQuery += ` AND s.current_status = ?`;
    countParams.push(status);
  }
  if (department && department !== 'All') {
    countQuery += ` AND s.department = ?`;
    countParams.push(department);
  }

  const totalCount = (db.prepare(countQuery).get(...countParams) as any).count;

  res.json({
    students,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalCount,
      totalPages: Math.ceil(totalCount / parseInt(limit, 10))
    }
  });
});

// 4. Detailed Student Profile Modal / View
hostelRouter.get('/students/:id', (req: AuthenticatedRequest, res) => {
  const student = db.prepare(`
    SELECT s.*, b.name as block_name, f.name as floor_name, h.name as hostel_name,
           r.capacity as room_capacity, r.occupied_count as room_occupied
    FROM students s
    LEFT JOIN blocks b ON s.block_id = b.id
    LEFT JOIN floors f ON s.floor_id = f.id
    LEFT JOIN hostels h ON s.hostel_id = h.id
    LEFT JOIN rooms r ON s.room_id = r.id
    WHERE s.id = ?
  `).get(req.params.id) as any;

  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  // Active leave
  const activeLeave = db.prepare(`
    SELECT * FROM leave_requests
    WHERE student_id = ? AND status = 'Approved'
    ORDER BY departure_date DESC LIMIT 1
  `).get(student.id);

  // Active movement
  const activeMovement = db.prepare(`
    SELECT m.*, l.destination, l.reason
    FROM movement_records m
    LEFT JOIN leave_requests l ON m.leave_request_id = l.id
    WHERE m.student_id = ? AND m.status IN ('Outside', 'Overdue')
    ORDER BY m.actual_departure_time DESC LIMIT 1
  `).get(student.id);

  // Recent 15 attendance records
  const attendanceHistory = db.prepare(`
    SELECT * FROM attendance_records
    WHERE student_id = ?
    ORDER BY timestamp DESC LIMIT 15
  `).all(student.id);

  // Recent 10 movement records
  const movementHistory = db.prepare(`
    SELECT m.*, l.leave_type, l.destination, l.reason
    FROM movement_records m
    LEFT JOIN leave_requests l ON m.leave_request_id = l.id
    WHERE m.student_id = ?
    ORDER BY m.actual_departure_time DESC LIMIT 10
  `).all(student.id);

  // Open and historical exceptions
  const exceptions = db.prepare(`
    SELECT * FROM exception_alerts
    WHERE student_id = ?
    ORDER BY created_at DESC LIMIT 10
  `).all(student.id);

  res.json({
    student,
    activeLeave,
    activeMovement,
    attendanceHistory,
    movementHistory,
    exceptions
  });
});

// 5. Update Student Info / Room Assignment
hostelRouter.put('/students/:id', (req: AuthenticatedRequest, res) => {
  const {
    phone,
    emergency_phone,
    parent_name,
    parent_phone,
    room_id,
    current_status,
    attendance_exempt
  } = req.body;

  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id) as any;
  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  let roomNumber = student.room_number;
  let blockId = student.block_id;
  let floorId = student.floor_id;

  if (room_id && room_id !== student.room_id) {
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(room_id) as any;
    if (room) {
      roomNumber = room.room_number;
      blockId = room.block_id;
      floorId = room.floor_id;
    }
  }

  db.prepare(`
    UPDATE students
    SET phone = ?,
        emergency_phone = ?,
        parent_name = ?,
        parent_phone = ?,
        room_id = ?,
        room_number = ?,
        block_id = ?,
        floor_id = ?,
        current_status = ?,
        attendance_exempt = ?
    WHERE id = ?
  `).run(
    phone || student.phone,
    emergency_phone || student.emergency_phone,
    parent_name || student.parent_name,
    parent_phone || student.parent_phone,
    room_id || student.room_id,
    roomNumber,
    blockId,
    floorId,
    current_status || student.current_status,
    attendance_exempt !== undefined ? (attendance_exempt ? 1 : 0) : student.attendance_exempt,
    req.params.id
  );

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details)
    VALUES (?, ?, 'UPDATE_STUDENT', 'students', ?, ?)
  `).run(
    `aud-${Date.now()}`,
    req.user!.id,
    req.params.id,
    `Admin/Warden updated student ${student.full_name} (${student.roll_number})`
  );

  res.json({ success: true, message: 'Student record updated successfully' });
});
