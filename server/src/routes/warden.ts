import { Router } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth.js';
import { runExceptionDetectionJob } from '../services/exceptionEngine.js';

export const wardenRouter = Router();

wardenRouter.use(authenticateToken);
wardenRouter.use(requireRole(['warden', 'admin']));

// 1. Warden Dashboard Overview Stats & Live Operational Metrics
wardenRouter.get('/stats', (req: AuthenticatedRequest, res) => {
  // Trigger exception detection check to keep data fresh
  runExceptionDetectionJob();

  const todayStr = new Date().toISOString().split('T')[0];

  // Total Students
  const totalStudents = (db.prepare('SELECT count(*) as count FROM students').get() as any).count;

  // Status breakdown
  const insideCount = (db.prepare(`SELECT count(*) as count FROM students WHERE current_status = 'Inside'`).get() as any).count;
  const leaveCount = (db.prepare(`SELECT count(*) as count FROM students WHERE current_status = 'On Leave'`).get() as any).count;
  const outsideCount = (db.prepare(`SELECT count(*) as count FROM students WHERE current_status = 'Outside'`).get() as any).count;

  // Attention Required (Open exceptions)
  const openExceptionsCount = (db.prepare(`
    SELECT count(*) as count FROM exception_alerts WHERE status IN ('Open', 'Acknowledged')
  `).get() as any).count;

  // Today's attendance overview
  const attendanceStats = db.prepare(`
    SELECT status, count(*) as count
    FROM attendance_records
    WHERE date = ?
    GROUP BY status
  `).all(todayStr) as { status: string; count: number }[];

  let presentToday = 0;
  let failedToday = 0;
  let excusedToday = 0;
  let absentToday = 0;

  for (const a of attendanceStats) {
    if (a.status === 'Present') presentToday = a.count;
    else if (a.status === 'Verification Failed') failedToday = a.count;
    else if (a.status === 'Excused') excusedToday = a.count;
    else if (a.status === 'Absent') absentToday = a.count;
  }

  const notGivenToday = Math.max(0, totalStudents - (presentToday + failedToday + excusedToday + absentToday));

  // Attention Required Queue (Top 10 open exceptions)
  const attentionQueue = db.prepare(`
    SELECT e.*, s.full_name, s.roll_number, s.room_number, s.phone, s.parent_phone, b.name as block_name
    FROM exception_alerts e
    JOIN students s ON e.student_id = s.id
    LEFT JOIN blocks b ON s.block_id = b.id
    WHERE e.status IN ('Open', 'Acknowledged')
    ORDER BY
      CASE e.severity
        WHEN 'Critical' THEN 1
        WHEN 'High' THEN 2
        WHEN 'Medium' THEN 3
        ELSE 4
      END,
      e.created_at DESC
    LIMIT 15
  `).all();

  // Pending Leave Approvals
  const pendingLeaves = db.prepare(`
    SELECT l.*, s.full_name, s.roll_number, s.room_number, s.phone, b.name as block_name
    FROM leave_requests l
    JOIN students s ON l.student_id = s.id
    LEFT JOIN blocks b ON s.block_id = b.id
    WHERE l.status = 'Pending'
    ORDER BY l.created_at ASC
    LIMIT 10
  `).all();

  // Recent Student Movements
  const recentMovements = db.prepare(`
    SELECT m.*, s.full_name, s.roll_number, s.room_number, l.leave_type, l.destination
    FROM movement_records m
    JOIN students s ON m.student_id = s.id
    LEFT JOIN leave_requests l ON m.leave_request_id = l.id
    ORDER BY m.created_at DESC
    LIMIT 10
  `).all();

  // Return Overdue Alerts (students outside where expected_return_time < NOW)
  const overdueAlerts = db.prepare(`
    SELECT m.*, s.full_name, s.roll_number, s.room_number, s.phone, s.parent_phone,
           l.leave_type, l.destination, l.reason
    FROM movement_records m
    JOIN students s ON m.student_id = s.id
    LEFT JOIN leave_requests l ON m.leave_request_id = l.id
    WHERE m.status = 'Overdue' OR (m.status = 'Outside' AND m.is_overdue = 1)
    ORDER BY m.overdue_minutes DESC
  `).all();

  // 7-Day Attendance Trend Chart
  const trendDays: any[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

    const dayRows = db.prepare(`
      SELECT status, count(*) as count
      FROM attendance_records
      WHERE date = ?
      GROUP BY status
    `).all(dateStr) as any[];

    let pres = 0;
    let abs = 0;
    let fail = 0;
    for (const r of dayRows) {
      if (r.status === 'Present') pres = r.count;
      if (r.status === 'Absent') abs = r.count;
      if (r.status === 'Verification Failed') fail = r.count;
    }

    trendDays.push({
      date: dateStr,
      day: dayName,
      present: pres,
      absent: abs,
      failed: fail
    });
  }

  res.json({
    kpis: {
      totalStudents,
      insideHostel: insideCount,
      onLeave: leaveCount,
      currentlyOutside: outsideCount,
      attentionRequired: openExceptionsCount
    },
    attendanceOverview: {
      present: presentToday,
      notGiven: notGivenToday,
      verificationFailed: failedToday,
      excused: excusedToday,
      totalStudents
    },
    attentionQueue,
    pendingLeaves,
    recentMovements,
    overdueAlerts,
    attendanceTrend: trendDays
  });
});

// 2. Warden Leave Approvals Queue
wardenRouter.get('/leaves', (req: AuthenticatedRequest, res) => {
  const { status, type, search, page = '1', limit = '20' } = req.query as any;

  let query = `
    SELECT l.*, s.full_name, s.roll_number, s.room_number, s.phone, s.emergency_phone,
           s.parent_name, b.name as block_name, u.full_name as reviewed_by_name
    FROM leave_requests l
    JOIN students s ON l.student_id = s.id
    LEFT JOIN blocks b ON s.block_id = b.id
    LEFT JOIN users u ON l.reviewed_by_user_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status && status !== 'All') {
    query += ` AND l.status = ?`;
    params.push(status);
  }

  if (type && type !== 'All') {
    query += ` AND l.leave_type = ?`;
    params.push(type);
  }

  if (search) {
    query += ` AND (s.full_name LIKE ? OR s.roll_number LIKE ? OR s.room_number LIKE ? OR l.destination LIKE ?)`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  query += ` ORDER BY l.created_at DESC`;

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  query += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit, 10), offset);

  const leaves = db.prepare(query).all(...params);

  // Total count for pagination
  let countQuery = `
    SELECT count(*) as count
    FROM leave_requests l
    JOIN students s ON l.student_id = s.id
    WHERE 1=1
  `;
  const countParams: any[] = [];
  if (status && status !== 'All') {
    countQuery += ` AND l.status = ?`;
    countParams.push(status);
  }
  if (type && type !== 'All') {
    countQuery += ` AND l.leave_type = ?`;
    countParams.push(type);
  }
  if (search) {
    countQuery += ` AND (s.full_name LIKE ? OR s.roll_number LIKE ? OR s.room_number LIKE ? OR l.destination LIKE ?)`;
    const searchPattern = `%${search}%`;
    countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }
  const totalCount = (db.prepare(countQuery).get(...countParams) as any).count;

  res.json({
    leaves,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalCount,
      totalPages: Math.ceil(totalCount / parseInt(limit, 10))
    }
  });
});

// Review Leave Request (Approve / Reject)
wardenRouter.post('/leaves/:id/review', (req: AuthenticatedRequest, res) => {
  const { action, remarks } = req.body;
  const leaveId = req.params.id;

  if (!['Approved', 'Rejected'].includes(action)) {
    return res.status(400).json({ error: "Action must be 'Approved' or 'Rejected'" });
  }

  const leave = db.prepare(`SELECT * FROM leave_requests WHERE id = ?`).get(leaveId) as any;
  if (!leave) {
    return res.status(404).json({ error: 'Leave request not found' });
  }

  if (leave.status !== 'Pending') {
    return res.status(400).json({ error: `Cannot review request that is already ${leave.status}` });
  }

  const reviewedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);

  db.prepare(`
    UPDATE leave_requests
    SET status = ?, warden_remarks = ?, reviewed_by_user_id = ?, reviewed_at = ?
    WHERE id = ?
  `).run(action, remarks || `Decision: ${action}`, req.user!.id, reviewedAt, leaveId);

  // If approved, create a pre-authorized movement record or active movement
  if (action === 'Approved') {
    const movId = `mov-${Date.now()}-${leave.student_id}`;
    db.prepare(`
      INSERT INTO movement_records (
        id, student_id, leave_request_id, movement_type, status,
        actual_departure_time, expected_return_time, departure_gate, created_at
      ) VALUES (?, ?, ?, ?, 'Outside', ?, ?, 'Main Campus Gate A', datetime('now'))
    `).run(
      movId,
      leave.student_id,
      leave.id,
      leave.leave_type,
      leave.departure_date,
      leave.expected_return_date
    );

    // Update student status to Outside or On Leave
    const newStatus = leave.leave_type === 'Home Leave' ? 'On Leave' : 'Outside';
    db.prepare(`UPDATE students SET current_status = ? WHERE id = ?`).run(newStatus, leave.student_id);
  }

  // Notify student
  const student = db.prepare('SELECT user_id, full_name FROM students WHERE id = ?').get(leave.student_id) as any;
  if (student) {
    db.prepare(`
      INSERT INTO notifications (id, user_id, student_id, title, message, type, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))
    `).run(
      `notif-${Date.now()}`,
      student.user_id,
      leave.student_id,
      `Leave Request ${action}`,
      `Your request for ${leave.leave_type} (${leave.destination}) was ${action.toLowerCase()} by warden. Remarks: ${remarks || 'None'}`,
      action === 'Approved' ? 'leave_approved' : 'leave_rejected'
    );
  }

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details)
    VALUES (?, ?, ?, 'leave_requests', ?, ?)
  `).run(
    `aud-${Date.now()}`,
    req.user!.id,
    `${action.toUpperCase()}_LEAVE`,
    leaveId,
    `Warden ${req.user!.full_name} ${action.toLowerCase()} leave request for student ${leave.student_id}`
  );

  res.json({
    success: true,
    message: `Leave request has been ${action.toLowerCase()}`,
    leaveId
  });
});

// 3. Warden Movement Management Queue (Tracking Outside & Overdue)
wardenRouter.get('/movements', (req: AuthenticatedRequest, res) => {
  const { status, search, page = '1', limit = '20' } = req.query as any;

  // Run overdue detector
  runExceptionDetectionJob();

  let query = `
    SELECT m.*, s.full_name, s.roll_number, s.room_number, s.phone, s.emergency_phone,
           s.parent_phone, b.name as block_name, l.destination, l.reason
    FROM movement_records m
    JOIN students s ON m.student_id = s.id
    LEFT JOIN blocks b ON s.block_id = b.id
    LEFT JOIN leave_requests l ON m.leave_request_id = l.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status && status !== 'All') {
    if (status === 'Overdue') {
      query += ` AND (m.status = 'Overdue' OR m.is_overdue = 1)`;
    } else {
      query += ` AND m.status = ?`;
      params.push(status);
    }
  }

  if (search) {
    query += ` AND (s.full_name LIKE ? OR s.roll_number LIKE ? OR s.room_number LIKE ? OR l.destination LIKE ?)`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  query += ` ORDER BY
    CASE m.status
      WHEN 'Overdue' THEN 1
      WHEN 'Outside' THEN 2
      ELSE 3
    END,
    m.created_at DESC
  `;

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  query += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit, 10), offset);

  const movements = db.prepare(query).all(...params);

  // Total count
  let countQuery = `
    SELECT count(*) as count
    FROM movement_records m
    JOIN students s ON m.student_id = s.id
    LEFT JOIN leave_requests l ON m.leave_request_id = l.id
    WHERE 1=1
  `;
  const countParams: any[] = [];
  if (status && status !== 'All') {
    if (status === 'Overdue') {
      countQuery += ` AND (m.status = 'Overdue' OR m.is_overdue = 1)`;
    } else {
      countQuery += ` AND m.status = ?`;
      countParams.push(status);
    }
  }
  if (search) {
    countQuery += ` AND (s.full_name LIKE ? OR s.roll_number LIKE ? OR s.room_number LIKE ? OR l.destination LIKE ?)`;
    const searchPattern = `%${search}%`;
    countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }
  const totalCount = (db.prepare(countQuery).get(...countParams) as any).count;

  res.json({
    movements,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalCount,
      totalPages: Math.ceil(totalCount / parseInt(limit, 10))
    }
  });
});

// Manual Gate Check-in by Warden / Security
wardenRouter.post('/movements/:id/gate-checkin', (req: AuthenticatedRequest, res) => {
  const { gate, notes } = req.body;
  const movementId = req.params.id;

  const mov = db.prepare('SELECT * FROM movement_records WHERE id = ?').get(movementId) as any;
  if (!mov) {
    return res.status(404).json({ error: 'Movement record not found' });
  }

  const returnTime = new Date().toISOString().replace('T', ' ').slice(0, 19);

  db.prepare(`
    UPDATE movement_records
    SET status = 'Returned',
        actual_return_time = ?,
        return_gate = ?,
        return_verification_method = 'Warden / Security Physical Gate Verification',
        return_notes = ?
    WHERE id = ?
  `).run(returnTime, gate || 'Main Campus Gate A', notes || `Verified by Warden ${req.user!.full_name}`, movementId);

  db.prepare(`UPDATE students SET current_status = 'Inside' WHERE id = ?`).run(mov.student_id);

  // Resolve open overdue alerts
  db.prepare(`
    UPDATE exception_alerts
    SET status = 'Resolved',
        resolution_notes = 'Warden physical gate confirmation at ' || ?,
        resolved_by_user_id = ?,
        resolved_at = datetime('now')
    WHERE student_id = ? AND type = 'OVERDUE_RETURN' AND status IN ('Open', 'Acknowledged')
  `).run(returnTime, req.user!.id, mov.student_id);

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details)
    VALUES (?, ?, 'GATE_RETURN_VERIFICATION', 'movement_records', ?, ?)
  `).run(
    `aud-${Date.now()}`,
    req.user!.id,
    movementId,
    `Manual gate entry verified for student ${mov.student_id}`
  );

  res.json({ success: true, message: 'Student return confirmed and recorded at gate.' });
});

// 4. Exceptions & Attention Required Queue
wardenRouter.get('/exceptions', (req: AuthenticatedRequest, res) => {
  const { status, severity, type, search, page = '1', limit = '20' } = req.query as any;

  let query = `
    SELECT e.*, s.full_name, s.roll_number, s.room_number, s.phone, s.emergency_phone,
           s.parent_name, s.parent_phone, b.name as block_name, u.full_name as resolved_by_name
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

  if (search) {
    query += ` AND (s.full_name LIKE ? OR s.roll_number LIKE ? OR s.room_number LIKE ? OR e.title LIKE ?)`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  query += ` ORDER BY
    CASE e.status
      WHEN 'Open' THEN 1
      WHEN 'Acknowledged' THEN 2
      ELSE 3
    END,
    CASE e.severity
      WHEN 'Critical' THEN 1
      WHEN 'High' THEN 2
      WHEN 'Medium' THEN 3
      ELSE 4
    END,
    e.created_at DESC
  `;

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  query += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit, 10), offset);

  const exceptions = db.prepare(query).all(...params);

  // Total count
  let countQuery = `
    SELECT count(*) as count
    FROM exception_alerts e
    JOIN students s ON e.student_id = s.id
    WHERE 1=1
  `;
  const countParams: any[] = [];
  if (status && status !== 'All') {
    countQuery += ` AND e.status = ?`;
    countParams.push(status);
  }
  if (severity && severity !== 'All') {
    countQuery += ` AND e.severity = ?`;
    countParams.push(severity);
  }
  if (type && type !== 'All') {
    countQuery += ` AND e.type = ?`;
    countParams.push(type);
  }
  if (search) {
    countQuery += ` AND (s.full_name LIKE ? OR s.roll_number LIKE ? OR s.room_number LIKE ? OR e.title LIKE ?)`;
    const searchPattern = `%${search}%`;
    countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }
  const totalCount = (db.prepare(countQuery).get(...countParams) as any).count;

  res.json({
    exceptions,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalCount,
      totalPages: Math.ceil(totalCount / parseInt(limit, 10))
    }
  });
});

// Take action on exception (Acknowledge, Resolve, Dismiss)
wardenRouter.post('/exceptions/:id/action', (req: AuthenticatedRequest, res) => {
  const { action, notes } = req.body;
  const exceptionId = req.params.id;

  if (!['Acknowledged', 'Resolved', 'Dismissed'].includes(action)) {
    return res.status(400).json({ error: "Action must be 'Acknowledged', 'Resolved', or 'Dismissed'" });
  }

  const exp = db.prepare('SELECT * FROM exception_alerts WHERE id = ?').get(exceptionId) as any;
  if (!exp) {
    return res.status(404).json({ error: 'Exception alert not found' });
  }

  if (action === 'Acknowledged') {
    db.prepare(`
      UPDATE exception_alerts
      SET status = 'Acknowledged',
          acknowledged_at = datetime('now')
      WHERE id = ?
    `).run(exceptionId);
  } else {
    db.prepare(`
      UPDATE exception_alerts
      SET status = ?,
          resolution_notes = ?,
          resolved_by_user_id = ?,
          resolved_at = datetime('now')
      WHERE id = ?
    `).run(action, notes || `Action taken: ${action}`, req.user!.id, exceptionId);
  }

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details)
    VALUES (?, ?, ?, 'exception_alerts', ?, ?)
  `).run(
    `aud-${Date.now()}`,
    req.user!.id,
    `EXCEPTION_${action.toUpperCase()}`,
    exceptionId,
    `Warden ${req.user!.full_name} marked exception as ${action}: ${notes || 'No notes'}`
  );

  res.json({ success: true, message: `Exception marked as ${action}` });
});
