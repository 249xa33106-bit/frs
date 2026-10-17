import { Router } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth.js';

export const reportsRouter = Router();

reportsRouter.use(authenticateToken);
reportsRouter.use(requireRole(['warden', 'admin']));

// 1. Daily Attendance Report
reportsRouter.get('/daily-attendance', (req: AuthenticatedRequest, res) => {
  const { date = new Date().toISOString().split('T')[0], block_id, status } = req.query as any;

  let query = `
    SELECT a.*, s.full_name, s.roll_number, s.room_number, s.department, b.name as block_name
    FROM attendance_records a
    JOIN students s ON a.student_id = s.id
    LEFT JOIN blocks b ON s.block_id = b.id
    WHERE a.date = ?
  `;
  const params: any[] = [date];

  if (block_id && block_id !== 'All') {
    query += ` AND s.block_id = ?`;
    params.push(block_id);
  }

  if (status && status !== 'All') {
    query += ` AND a.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY s.roll_number ASC`;

  const records = db.prepare(query).all(...params);

  // Summary counts
  let present = 0, absent = 0, failed = 0, excused = 0;
  for (const r of records as any[]) {
    if (r.status === 'Present') present++;
    else if (r.status === 'Absent') absent++;
    else if (r.status === 'Verification Failed') failed++;
    else if (r.status === 'Excused') excused++;
  }

  res.json({
    generatedAt: new Date().toISOString(),
    filters: { date, block_id, status },
    summary: { total: records.length, present, absent, failed, excused },
    records
  });
});

// 2. Student-Wise Attendance Report
reportsRouter.get('/student-wise', (req: AuthenticatedRequest, res) => {
  const { roll_number, student_id, start_date, end_date } = req.query as any;

  let student: any = null;
  if (student_id) {
    student = db.prepare('SELECT * FROM students WHERE id = ?').get(student_id);
  } else if (roll_number) {
    student = db.prepare('SELECT * FROM students WHERE roll_number = ?').get(roll_number);
  }

  if (!student) {
    return res.status(404).json({ error: 'Student not found with provided roll number or ID' });
  }

  let query = `
    SELECT * FROM attendance_records
    WHERE student_id = ?
  `;
  const params: any[] = [student.id];

  if (start_date) {
    query += ` AND date >= ?`;
    params.push(start_date);
  }

  if (end_date) {
    query += ` AND date <= ?`;
    params.push(end_date);
  }

  query += ` ORDER BY date DESC`;

  const records = db.prepare(query).all(...params);

  let present = 0, absent = 0, failed = 0, excused = 0;
  for (const r of records as any[]) {
    if (r.status === 'Present') present++;
    else if (r.status === 'Absent') absent++;
    else if (r.status === 'Verification Failed') failed++;
    else if (r.status === 'Excused') excused++;
  }

  const attendanceRate = records.length > 0 ? Math.round((present / records.length) * 100) : 0;

  res.json({
    generatedAt: new Date().toISOString(),
    student,
    summary: {
      totalDays: records.length,
      present,
      absent,
      failed,
      excused,
      attendanceRate: `${attendanceRate}%`
    },
    records
  });
});

// 3. Room-Wise Attendance & Occupancy Report
reportsRouter.get('/room-wise', (req: AuthenticatedRequest, res) => {
  const { block_id, floor_id } = req.query as any;

  let query = `
    SELECT r.*, b.name as block_name, f.name as floor_name,
           (SELECT count(*) FROM students s WHERE s.room_id = r.id) as total_students,
           (SELECT count(*) FROM students s WHERE s.room_id = r.id AND s.current_status = 'Inside') as inside_students,
           (SELECT count(*) FROM students s WHERE s.room_id = r.id AND s.current_status = 'Outside') as outside_students,
           (SELECT count(*) FROM students s WHERE s.room_id = r.id AND s.current_status = 'On Leave') as leave_students
    FROM rooms r
    JOIN blocks b ON r.block_id = b.id
    JOIN floors f ON r.floor_id = f.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (block_id && block_id !== 'All') {
    query += ` AND r.block_id = ?`;
    params.push(block_id);
  }

  if (floor_id && floor_id !== 'All') {
    query += ` AND r.floor_id = ?`;
    params.push(floor_id);
  }

  query += ` ORDER BY r.room_number ASC`;

  const rooms = db.prepare(query).all(...params);

  res.json({
    generatedAt: new Date().toISOString(),
    filters: { block_id, floor_id },
    totalRooms: rooms.length,
    rooms
  });
});

// 4. Leave & Movement History Report
reportsRouter.get('/movement-history', (req: AuthenticatedRequest, res) => {
  const { start_date, end_date, movement_type, status } = req.query as any;

  let query = `
    SELECT m.*, s.full_name, s.roll_number, s.room_number, s.phone,
           l.destination, l.reason, b.name as block_name
    FROM movement_records m
    JOIN students s ON m.student_id = s.id
    LEFT JOIN blocks b ON s.block_id = b.id
    LEFT JOIN leave_requests l ON m.leave_request_id = l.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (start_date) {
    query += ` AND date(m.actual_departure_time) >= ?`;
    params.push(start_date);
  }

  if (end_date) {
    query += ` AND date(m.actual_departure_time) <= ?`;
    params.push(end_date);
  }

  if (movement_type && movement_type !== 'All') {
    query += ` AND m.movement_type = ?`;
    params.push(movement_type);
  }

  if (status && status !== 'All') {
    query += ` AND m.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY m.actual_departure_time DESC`;

  const movements = db.prepare(query).all(...params);

  res.json({
    generatedAt: new Date().toISOString(),
    totalMovements: movements.length,
    movements
  });
});

// 5. Overdue Returns Report
reportsRouter.get('/overdue-summary', (req: AuthenticatedRequest, res) => {
  const query = `
    SELECT m.*, s.full_name, s.roll_number, s.room_number, s.phone, s.emergency_phone,
           s.parent_name, s.parent_phone, b.name as block_name, l.destination, l.reason
    FROM movement_records m
    JOIN students s ON m.student_id = s.id
    LEFT JOIN blocks b ON s.block_id = b.id
    LEFT JOIN leave_requests l ON m.leave_request_id = l.id
    WHERE m.status = 'Overdue' OR m.is_overdue = 1
    ORDER BY m.overdue_minutes DESC
  `;

  const overdues = db.prepare(query).all();

  res.json({
    generatedAt: new Date().toISOString(),
    totalOverdues: overdues.length,
    overdues
  });
});

// 6. Exception Report
reportsRouter.get('/exceptions', (req: AuthenticatedRequest, res) => {
  const { status, severity, type } = req.query as any;

  let query = `
    SELECT e.*, s.full_name, s.roll_number, s.room_number, b.name as block_name,
           u.full_name as resolved_by_name
    FROM exception_alerts e
    JOIN students s ON e.student_id = s.id
    LEFT JOIN blocks b ON s.block_id = b.id
    LEFT JOIN users u ON e.resolved_by_user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status && status !== 'All') {
    query += ` AND e.status = ?`;
    params.push(status);
  }

  if (severity && severity !== 'All') {
    query += ` AND e.severity = ?`;
    params.push(severity);
  }

  if (type && type !== 'All') {
    query += ` AND e.type = ?`;
    params.push(type);
  }

  query += ` ORDER BY e.created_at DESC`;

  const exceptions = db.prepare(query).all(...params);

  res.json({
    generatedAt: new Date().toISOString(),
    totalExceptions: exceptions.length,
    exceptions
  });
});

// 7. CSV Export Generator
reportsRouter.get('/export-csv', (req: AuthenticatedRequest, res) => {
  const { type = 'daily-attendance', date = new Date().toISOString().split('T')[0] } = req.query as any;

  let csvContent = '';
  let filename = `hostel_report_${type}_${date}.csv`;

  if (type === 'daily-attendance') {
    const rows = db.prepare(`
      SELECT a.date, s.roll_number, s.full_name, s.room_number, b.name as block,
             a.status, a.confidence_score, a.distance_from_hostel_meters, a.timestamp
      FROM attendance_records a
      JOIN students s ON a.student_id = s.id
      LEFT JOIN blocks b ON s.block_id = b.id
      WHERE a.date = ?
      ORDER BY s.roll_number ASC
    `).all(date) as any[];

    csvContent = 'Date,Roll Number,Full Name,Room Number,Block,Status,Biometric Confidence,Distance (m),Timestamp\n';
    for (const r of rows) {
      csvContent += `"${r.date}","${r.roll_number}","${r.full_name}","${r.room_number}","${r.block || ''}","${r.status}","${r.confidence_score || ''}","${r.distance_from_hostel_meters || ''}","${r.timestamp}"\n`;
    }
  } else if (type === 'overdue-summary') {
    const rows = db.prepare(`
      SELECT s.roll_number, s.full_name, s.room_number, b.name as block,
             m.actual_departure_time, m.expected_return_time, m.overdue_minutes,
             s.phone, s.parent_phone, l.destination
      FROM movement_records m
      JOIN students s ON m.student_id = s.id
      LEFT JOIN blocks b ON s.block_id = b.id
      LEFT JOIN leave_requests l ON m.leave_request_id = l.id
      WHERE m.status = 'Overdue' OR m.is_overdue = 1
      ORDER BY m.overdue_minutes DESC
    `).all() as any[];

    csvContent = 'Roll Number,Full Name,Room,Block,Departure,Expected Return,Overdue Minutes,Phone,Parent Phone,Destination\n';
    for (const r of rows) {
      csvContent += `"${r.roll_number}","${r.full_name}","${r.room_number}","${r.block || ''}","${r.actual_departure_time}","${r.expected_return_time}","${r.overdue_minutes}","${r.phone}","${r.parent_phone}","${r.destination || ''}"\n`;
    }
  } else {
    // Default: students list export
    const rows = db.prepare(`
      SELECT s.roll_number, s.full_name, s.room_number, b.name as block, s.current_status, s.department, s.phone
      FROM students s
      LEFT JOIN blocks b ON s.block_id = b.id
      ORDER BY s.roll_number ASC
    `).all() as any[];

    csvContent = 'Roll Number,Full Name,Room,Block,Current Status,Department,Phone\n';
    for (const r of rows) {
      csvContent += `"${r.roll_number}","${r.full_name}","${r.room_number}","${r.block || ''}","${r.current_status}","${r.department}","${r.phone}"\n`;
    }
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
});
