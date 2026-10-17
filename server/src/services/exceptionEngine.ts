import { db } from '../db.js';

export function runExceptionDetectionJob(): {
  overdueCount: number;
  missingAttendanceCount: number;
  expiredLeaveCount: number;
} {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const nowIsoStr = now.toISOString().replace('T', ' ').slice(0, 16);

  // Get system settings
  const settingsRows = db.prepare('SELECT key, value FROM system_settings').all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const s of settingsRows) {
    settings[s.key] = s.value;
  }

  const graceMinutes = parseInt(settings.overdue_grace_minutes || '15', 10);
  const curfewTime = settings.attendance_curfew_time || '21:30';

  let overdueCount = 0;
  let missingAttendanceCount = 0;
  let expiredLeaveCount = 0;

  // 1. Detect Overdue Returns
  // Find movement records that are 'Outside' or 'Overdue' where expected_return_time < (NOW - graceMinutes)
  const openMovements = db.prepare(`
    SELECT m.*, s.full_name, s.roll_number, s.room_number, s.phone, s.emergency_phone
    FROM movement_records m
    JOIN students s ON m.student_id = s.id
    WHERE m.status IN ('Outside', 'Overdue')
  `).all() as any[];

  for (const mov of openMovements) {
    const expDate = new Date(mov.expected_return_time.replace(' ', 'T'));
    const diffMinutes = Math.floor((now.getTime() - expDate.getTime()) / (1000 * 60));

    if (diffMinutes > graceMinutes) {
      // Mark movement as overdue
      db.prepare(`
        UPDATE movement_records
        SET is_overdue = 1, status = 'Overdue', overdue_minutes = ?
        WHERE id = ?
      `).run(diffMinutes, mov.id);

      // Check if an open or acknowledged exception alert already exists for this student and movement
      const existingAlert = db.prepare(`
        SELECT id FROM exception_alerts
        WHERE student_id = ?
          AND type = 'OVERDUE_RETURN'
          AND status IN ('Open', 'Acknowledged')
      `).get(mov.student_id) as any;

      if (!existingAlert) {
        const severity = diffMinutes > 180 ? 'Critical' : diffMinutes > 60 ? 'High' : 'Medium';
        const expId = `exp-auto-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        db.prepare(`
          INSERT INTO exception_alerts (
            id, student_id, type, severity, status, title, description, created_at
          ) VALUES (?, ?, 'OVERDUE_RETURN', ?, 'Open', ?, ?, datetime('now'))
        `).run(
          expId,
          mov.student_id,
          severity,
          `Return Overdue: ${mov.full_name} (${mov.room_number}) is ${diffMinutes}m overdue`,
          `Student was scheduled to return by ${mov.expected_return_time}. Currently outside for ${diffMinutes} minutes beyond expected return. Contact: ${mov.phone}`
        );

        // Add a notification for wardens
        db.prepare(`
          INSERT INTO notifications (id, user_id, student_id, title, message, type, is_read, created_at)
          VALUES (?, NULL, ?, ?, ?, 'overdue_alert', 0, datetime('now'))
        `).run(
          `notif-ov-${Date.now()}`,
          mov.student_id,
          `Return Overdue: ${mov.full_name}`,
          `Student ${mov.full_name} (${mov.roll_number}) is ${diffMinutes} minutes overdue.`
        );

        overdueCount++;
      }
    }
  }

  // 2. Detect Missing Curfew Attendance
  // Only trigger if current time is past configured attendance curfew time
  const currentHours = now.getHours();
  const currentMins = now.getMinutes();
  const [curfewH, curfewM] = curfewTime.split(':').map((x) => parseInt(x, 10));

  const isPastCurfew = (currentHours > curfewH) || (currentHours === curfewH && currentMins >= curfewM);

  if (isPastCurfew) {
    // Find students whose current_status is 'Inside', but who have no attendance record for today
    const missingStudents = db.prepare(`
      SELECT s.id, s.full_name, s.roll_number, s.room_number
      FROM students s
      WHERE s.current_status = 'Inside'
        AND s.attendance_exempt = 0
        AND s.id NOT IN (
          SELECT student_id FROM attendance_records WHERE date = ?
        )
      LIMIT 100
    `).all(todayStr) as any[];

    for (const std of missingStudents) {
      // Check if an alert already created today for this student
      const existingAlert = db.prepare(`
        SELECT id FROM exception_alerts
        WHERE student_id = ?
          AND type = 'ATTENDANCE_NOT_SUBMITTED'
          AND date(created_at) = date('now')
      `).get(std.id) as any;

      if (!existingAlert) {
        const expId = `exp-att-${Date.now()}-${std.id}`;
        db.prepare(`
          INSERT INTO exception_alerts (
            id, student_id, type, severity, status, title, description, created_at
          ) VALUES (?, ?, 'ATTENDANCE_NOT_SUBMITTED', 'High', 'Open', ?, ?, datetime('now'))
        `).run(
          expId,
          std.id,
          `Curfew Attendance Missing: ${std.full_name} (${std.room_number})`,
          `Student has not marked evening attendance before ${curfewTime} deadline and has no active leave.`
        );
        missingAttendanceCount++;
      }
    }
  }

  // 3. Detect Expired Leaves
  // Leave requests where status = 'Approved' and expected_return_date < NOW
  const expiredLeaves = db.prepare(`
    SELECT l.*, s.full_name, s.roll_number, s.room_number
    FROM leave_requests l
    JOIN students s ON l.student_id = s.id
    WHERE l.status = 'Approved'
      AND l.expected_return_date < ?
  `).all(nowIsoStr) as any[];

  for (const l of expiredLeaves) {
    db.prepare(`
      UPDATE leave_requests
      SET status = 'Expired'
      WHERE id = ?
    `).run(l.id);
    expiredLeaveCount++;
  }

  return {
    overdueCount,
    missingAttendanceCount,
    expiredLeaveCount
  };
}
