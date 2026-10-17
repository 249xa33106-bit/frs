import { Router } from 'express';
import { db } from '../db.js';
import { AuthenticatedRequest, authenticateToken, requireRole } from '../middleware/auth.js';
import { calculateDistanceMeters } from '../utils/geo.js';
import { verifyFaceBiometrics, detectFaceBiometrics } from '../utils/faceClient.js';

export const studentRouter = Router();

// Apply auth middleware to all student routes
studentRouter.use(authenticateToken);
studentRouter.use(requireRole(['student', 'warden', 'admin']));

// Helper to get student record for current user
function getStudentForUser(userId: string): any {
  return db.prepare(`
    SELECT s.*, b.name as block_name, f.name as floor_name, h.name as hostel_name,
           h.latitude as hostel_lat, h.longitude as hostel_lng, h.geofence_radius_meters
    FROM students s
    LEFT JOIN blocks b ON s.block_id = b.id
    LEFT JOIN floors f ON s.floor_id = f.id
    LEFT JOIN hostels h ON s.hostel_id = h.id
    WHERE s.user_id = ?
  `).get(userId);
}

// 1. Student Dashboard Data
studentRouter.get('/dashboard', (req: AuthenticatedRequest, res) => {
  const student = getStudentForUser(req.user!.id);
  if (!student) {
    return res.status(404).json({ error: 'Student record not found for this user account' });
  }

  const todayStr = new Date().toISOString().split('T')[0];

  // Today's attendance
  const todayAttendance = db.prepare(`
    SELECT * FROM attendance_records
    WHERE student_id = ? AND date = ?
    ORDER BY timestamp DESC LIMIT 1
  `).get(student.id, todayStr) as any;

  // Active open movement
  const activeMovement = db.prepare(`
    SELECT m.*, l.reason, l.destination, l.leave_type
    FROM movement_records m
    LEFT JOIN leave_requests l ON m.leave_request_id = l.id
    WHERE m.student_id = ? AND m.status IN ('Outside', 'Overdue')
    ORDER BY m.actual_departure_time DESC LIMIT 1
  `).get(student.id) as any;

  // Pending leaves
  const pendingLeaves = db.prepare(`
    SELECT * FROM leave_requests
    WHERE student_id = ? AND status = 'Pending'
    ORDER BY created_at DESC
  `).all(student.id) as any[];

  // Recent approved leaves
  const approvedLeaves = db.prepare(`
    SELECT * FROM leave_requests
    WHERE student_id = ? AND status = 'Approved'
    ORDER BY departure_date DESC LIMIT 3
  `).all(student.id) as any[];

  // Recent notifications
  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE student_id = ? OR user_id = ?
    ORDER BY created_at DESC LIMIT 5
  `).all(student.id, req.user!.id) as any[];

  // System settings
  const curfewSetting = db.prepare(`SELECT value FROM system_settings WHERE key = 'attendance_curfew_time'`).get() as any;
  const radiusSetting = db.prepare(`SELECT value FROM system_settings WHERE key = 'geofence_radius_meters'`).get() as any;

  res.json({
    student,
    todayAttendance,
    activeMovement,
    pendingLeaves,
    approvedLeaves,
    notifications,
    settings: {
      curfewTime: curfewSetting ? curfewSetting.value : '21:30',
      geofenceRadius: radiusSetting ? parseInt(radiusSetting.value, 10) : 250,
      hostelLat: student.hostel_lat || 28.5450,
      hostelLng: student.hostel_lng || 77.1926
    }
  });
});

// 2. Give Attendance (FRS + Geofencing + Liveness)
studentRouter.post('/attendance', async (req: AuthenticatedRequest, res) => {
  try {
    const student = getStudentForUser(req.user!.id);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: 'Student Profile Missing',
        message: 'No student record linked to this account. Please switch to a student persona in the top navigation bar.'
      });
    }

    const {
      imageBase64,
      latitude,
      longitude,
      clientSignals // e.g. wifi, battery, user-agent
    } = req.body;

    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Check for duplicate attendance submission
    const existingAttendance = db.prepare(`
      SELECT * FROM attendance_records
      WHERE student_id = ? AND date = ? AND status = 'Present'
    `).get(student.id, todayStr) as any;

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        error: 'Duplicate Submission',
        message: `Attendance for today (${todayStr}) is already recorded as Present at ${existingAttendance.timestamp}.`
      });
    }

    // 2. Validate Image Submission (Prevent fake / click-only verification)
    if (!imageBase64 || imageBase64.length < 500) {
      return res.status(400).json({
        success: false,
        error: 'Camera Frame Required',
        message: 'Live face capture is mandatory. Never submit without an active camera feed.'
      });
    }

    // 3. Location / Geofence Verification
    const hostelLat = student.hostel_lat || 28.5450;
    const hostelLng = student.hostel_lng || 77.1926;
    const maxRadius = student.geofence_radius_meters || 250;

    let distanceMeters = 0;
    let locationVerified = 1;
    let locationError: string | null = null;

    if (latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null) {
      distanceMeters = calculateDistanceMeters(Number(latitude), Number(longitude), hostelLat, hostelLng);
      if (distanceMeters > maxRadius) {
        locationVerified = 0;
        locationError = `Location outside hostel perimeter: ${distanceMeters}m from campus center (Allowed radius: ${maxRadius}m).`;
      }
    } else {
      // If location unavailable in browser, record as unverified location
      locationVerified = 0;
      locationError = 'GPS location coordinates unavailable. Please enable browser location permissions.';
    }

    // Parse enrolled biometric template
    let targetDescriptor: number[] | null = null;
    if (student.face_descriptor) {
      try {
        targetDescriptor = JSON.parse(student.face_descriptor);
      } catch (e) {
        // ignore parse error
      }
    }

    // 4. Biometric Face Recognition & Liveness Verification
    const faceResult = await verifyFaceBiometrics(imageBase64, targetDescriptor, student.roll_number);

    const verificationSuccess = faceResult.matched && (locationVerified === 1);
    const status = verificationSuccess ? 'Present' : 'Verification Failed';
    const failureReason = !faceResult.matched
      ? faceResult.message
      : (locationError || 'Verification conditions not met');

    const recordId = `att-${Date.now()}-${student.id}`;

    // 5. Store Attendance Record
    db.prepare(`
      INSERT INTO attendance_records (
        id, student_id, date, session_name, status, verification_method,
        confidence_score, liveness_verified, location_verified, latitude,
        longitude, distance_from_hostel_meters, verification_signals,
        failure_reason, timestamp
      ) VALUES (?, ?, ?, 'Evening Curfew Check', ?, 'Face + Geolocation', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      recordId,
      student.id,
      todayStr,
      status,
      faceResult.confidence,
      faceResult.livenessPassed ? 1 : 0,
      locationVerified,
      latitude || null,
      longitude || null,
      distanceMeters,
      JSON.stringify(clientSignals || {}),
      verificationSuccess ? null : failureReason
    );

    // 6. Handle side effects
    if (verificationSuccess) {
      // Update student status to Inside if they weren't on approved leave
      if (student.current_status !== 'On Leave') {
        db.prepare(`UPDATE students SET current_status = 'Inside' WHERE id = ?`).run(student.id);
      }

      // Resolve any open ATTENDANCE_NOT_SUBMITTED exception for today
      db.prepare(`
        UPDATE exception_alerts
        SET status = 'Resolved', resolution_notes = 'Attendance submitted and verified via FRS', resolved_at = datetime('now')
        WHERE student_id = ? AND type = 'ATTENDANCE_NOT_SUBMITTED' AND status IN ('Open', 'Acknowledged')
      `).run(student.id);

      return res.json({
        success: true,
        status: 'Present',
        message: 'Attendance verified successfully! Face match and location validated.',
        timestamp: new Date().toLocaleTimeString(),
        diagnostics: {
          faceConfidence: `${Math.round(faceResult.confidence * 100)}%`,
          liveness: faceResult.livenessPassed ? 'Passed' : 'Failed',
          distanceMeters: `${distanceMeters}m from hostel`,
          serviceStatus: faceResult.serviceStatus
        }
      });
    } else {
      // Log exception alert for warden attention
      const expId = `exp-fail-${Date.now()}-${student.id}`;
      const expTitle = !faceResult.matched
        ? `Face Verification Failed: ${student.full_name} (${student.room_number})`
        : `Geofence Violation: ${student.full_name} (${student.room_number})`;

      db.prepare(`
        INSERT INTO exception_alerts (
          id, student_id, type, severity, status, title, description, created_at
        ) VALUES (?, ?, ?, 'Medium', 'Open', ?, ?, datetime('now'))
      `).run(
        expId,
        student.id,
        !faceResult.matched ? 'VERIFICATION_FAILED' : 'INVALID_LOCATION',
        expTitle,
        `Attempted attendance rejected at ${new Date().toLocaleTimeString()}. Reason: ${failureReason}. Confidence: ${Math.round(faceResult.confidence * 100)}%. Distance: ${distanceMeters}m.`
      );

      return res.status(422).json({
        success: false,
        status: 'Verification Failed',
        error: 'Verification Failed',
        message: failureReason,
        diagnostics: {
          faceConfidence: `${Math.round(faceResult.confidence * 100)}%`,
          liveness: faceResult.livenessPassed ? 'Passed' : 'Failed',
          distanceMeters: `${distanceMeters}m`,
          serviceStatus: faceResult.serviceStatus
        }
      });
    }
  } catch (err: any) {
    console.error('Error processing attendance:', err);
    return res.status(500).json({
      success: false,
      error: 'Processing Error',
      message: err.message || 'An error occurred while verifying attendance.'
    });
  }
});

// 3. Apply for Leave / Outing
studentRouter.post('/leaves', (req: AuthenticatedRequest, res) => {
  const student = getStudentForUser(req.user!.id);
  if (!student) {
    return res.status(404).json({ error: 'Student profile not found' });
  }

  const {
    leave_type,
    reason,
    destination,
    departure_date,
    expected_return_date,
    parent_consent_phone
  } = req.body;

  if (!leave_type || !reason || !destination || !departure_date || !expected_return_date) {
    return res.status(400).json({ error: 'All fields (type, reason, destination, departure, return) are required' });
  }

  const dep = new Date(departure_date.replace(' ', 'T'));
  const ret = new Date(expected_return_date.replace(' ', 'T'));

  if (ret <= dep) {
    return res.status(400).json({ error: 'Expected return time must be strictly after departure time' });
  }

  const leaveId = `leave-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  db.prepare(`
    INSERT INTO leave_requests (
      id, student_id, leave_type, reason, destination, departure_date,
      expected_return_date, status, parent_informed, parent_consent_phone,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', 1, ?, datetime('now'))
  `).run(
    leaveId,
    student.id,
    leave_type,
    reason,
    destination,
    departure_date,
    expected_return_date,
    parent_consent_phone || student.parent_phone
  );

  // Notify wardens
  db.prepare(`
    INSERT INTO notifications (id, user_id, student_id, title, message, type, is_read, created_at)
    VALUES (?, NULL, ?, ?, ?, 'system', 0, datetime('now'))
  `).run(
    `notif-req-${Date.now()}`,
    student.id,
    `New Leave Request: ${student.full_name}`,
    `${student.full_name} (${student.room_number}) submitted a ${leave_type} request for ${destination}.`
  );

  res.json({
    success: true,
    message: 'Leave application submitted successfully. Pending warden approval.',
    leaveId
  });
});

// 4. List Student's Leave Requests
studentRouter.get('/leaves', (req: AuthenticatedRequest, res) => {
  const student = getStudentForUser(req.user!.id);
  if (!student) {
    return res.status(404).json({ error: 'Student profile not found' });
  }

  const leaves = db.prepare(`
    SELECT l.*, u.full_name as reviewer_name
    FROM leave_requests l
    LEFT JOIN users u ON l.reviewed_by_user_id = u.id
    WHERE l.student_id = ?
    ORDER BY l.created_at DESC
  `).all(student.id);

  res.json({ leaves });
});

// 5. Incoming / Return ("I Have Returned")
studentRouter.post('/return', (req: AuthenticatedRequest, res) => {
  const student = getStudentForUser(req.user!.id);
  if (!student) {
    return res.status(404).json({ error: 'Student profile not found' });
  }

  const { latitude, longitude, return_gate, notes } = req.body;

  // Find active open movement record
  const activeMovement = db.prepare(`
    SELECT * FROM movement_records
    WHERE student_id = ? AND status IN ('Outside', 'Overdue')
    ORDER BY actual_departure_time DESC LIMIT 1
  `).get(student.id) as any;

  if (!activeMovement) {
    return res.status(400).json({
      error: 'No Active Outside Movement',
      message: 'You currently have no recorded outside movement or you have already marked your return.'
    });
  }

  const returnTime = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // Close movement record
  db.prepare(`
    UPDATE movement_records
    SET status = 'Returned',
        actual_return_time = ?,
        return_gate = ?,
        return_verification_method = 'Student Return Portal Button',
        return_location_lat = ?,
        return_location_lng = ?,
        return_notes = ?
    WHERE id = ?
  `).run(
    returnTime,
    return_gate || 'Main Campus Gate A',
    latitude || null,
    longitude || null,
    notes || 'Confirmed return by student',
    activeMovement.id
  );

  // Update student status to Inside
  db.prepare(`UPDATE students SET current_status = 'Inside' WHERE id = ?`).run(student.id);

  // Resolve any open OVERDUE_RETURN exceptions for this student
  db.prepare(`
    UPDATE exception_alerts
    SET status = 'Resolved',
        resolution_notes = 'Student returned and checked in via portal at ' || ?,
        resolved_at = datetime('now')
    WHERE student_id = ? AND type = 'OVERDUE_RETURN' AND status IN ('Open', 'Acknowledged')
  `).run(returnTime, student.id);

  // Log in notifications
  db.prepare(`
    INSERT INTO notifications (id, user_id, student_id, title, message, type, is_read, created_at)
    VALUES (?, ?, ?, 'Return Confirmed', ?, 'system', 0, datetime('now'))
  `).run(
    `notif-ret-${Date.now()}`,
    student.user_id,
    student.id,
    `Your return at ${returnTime} has been recorded. Current status updated to Inside Hostel.`
  );

  res.json({
    success: true,
    message: 'Welcome back! Return confirmed and recorded on server.',
    returnTime,
    movementId: activeMovement.id
  });
});

// 6. Unified Movement & Attendance History
studentRouter.get('/history', (req: AuthenticatedRequest, res) => {
  const student = getStudentForUser(req.user!.id);
  if (!student) {
    return res.status(404).json({ error: 'Student profile not found' });
  }

  const attendanceHistory = db.prepare(`
    SELECT * FROM attendance_records
    WHERE student_id = ?
    ORDER BY timestamp DESC LIMIT 30
  `).all(student.id);

  const movementHistory = db.prepare(`
    SELECT m.*, l.leave_type, l.reason, l.destination
    FROM movement_records m
    LEFT JOIN leave_requests l ON m.leave_request_id = l.id
    WHERE m.student_id = ?
    ORDER BY m.actual_departure_time DESC LIMIT 30
  `).all(student.id);

  res.json({
    attendanceHistory,
    movementHistory
  });
});

// 7. Notifications
studentRouter.get('/notifications', (req: AuthenticatedRequest, res) => {
  const student = getStudentForUser(req.user!.id);
  const studentId = student ? student.id : null;

  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ? OR (student_id = ? AND user_id IS NULL)
    ORDER BY created_at DESC LIMIT 50
  `).all(req.user!.id, studentId);

  res.json({ notifications });
});

studentRouter.patch('/notifications/:id/read', (req: AuthenticatedRequest, res) => {
  db.prepare(`
    UPDATE notifications SET is_read = 1 WHERE id = ?
  `).run(req.params.id);
  res.json({ success: true });
});

// 8. Self-Enroll Live Biometric Face Template
studentRouter.post('/enroll-face', async (req: AuthenticatedRequest, res) => {
  try {
    const student = getStudentForUser(req.user!.id);
    if (!student) {
      return res.status(404).json({ error: 'Student profile not found for this account' });
    }

    const { imageBase64, descriptor } = req.body;

    let finalDescriptor: number[] | null = descriptor || null;

    if (!finalDescriptor && imageBase64) {
      // Call OpenCV FastAPI to detect face and compute 32-bin vector
      const detectResult = await detectFaceBiometrics(imageBase64);
      if (!detectResult.success || !detectResult.detected || !detectResult.descriptor) {
        return res.status(422).json({
          success: false,
          error: 'No Face Recognized',
          message: detectResult.message || 'No clear face detected in the camera frame. Please center your face in the oval guide.'
        });
      }

      finalDescriptor = detectResult.descriptor;
    }

    if (!finalDescriptor || !Array.isArray(finalDescriptor) || finalDescriptor.length === 0) {
      return res.status(400).json({ error: 'Valid biometric descriptor vector or camera frame is required.' });
    }

    const descriptorStr = JSON.stringify(finalDescriptor);

    db.prepare(`
      UPDATE students
      SET face_descriptor = ?,
          has_face_enrolled = 1,
          face_enrolled_at = datetime('now')
      WHERE id = ?
    `).run(descriptorStr, student.id);

    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details)
      VALUES (?, ?, 'STUDENT_ENROLL_FACE', 'students', ?, ?)
    `).run(
      `aud-${Date.now()}`,
      req.user!.id,
      student.id,
      `Student ${student.full_name} (${student.roll_number}) enrolled real live face template`
    );

    res.json({
      success: true,
      message: 'Biometric face template registered successfully! You can now verify attendance using live FRS.',
      faceEnrolledAt: new Date().toLocaleTimeString(),
      descriptorLength: finalDescriptor.length
    });
  } catch (err: any) {
    console.error('Error enrolling face:', err);
    res.status(500).json({ error: err.message || 'Face enrollment failed' });
  }
});
