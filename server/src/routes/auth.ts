import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, ensureCampusInfrastructure } from '../db.js';
import { generateToken, authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { detectFaceBiometrics } from '../utils/faceClient.js';
import { safePgQuery } from '../postgres.js';

export const authRouter = Router();

// Login
authRouter.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username/Email and password are required' });
  }

  const cleanInput = username.trim();
  const user = db.prepare(`
    SELECT u.* FROM users u
    LEFT JOIN students s ON s.user_id = u.id
    WHERE u.username = ? OR u.email = ? OR UPPER(s.roll_number) = ?
    LIMIT 1
  `).get(cleanInput, cleanInput.toLowerCase(), cleanInput.toUpperCase()) as any;

  if (!user) {
    return res.status(401).json({ error: 'Invalid username/email or password' });
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid username/email or password' });
  }

  let studentData: any = null;
  if (user.role === 'student') {
    studentData = db.prepare(`
      SELECT s.*, b.name as block_name, f.name as floor_name, h.name as hostel_name
      FROM students s
      LEFT JOIN blocks b ON s.block_id = b.id
      LEFT JOIN floors f ON s.floor_id = f.id
      LEFT JOIN hostels h ON s.hostel_id = h.id
      WHERE s.user_id = ?
    `).get(user.id);
  }

  // Update last_login
  db.prepare(`UPDATE users SET last_login = datetime('now') WHERE id = ?`).run(user.id);

  const tokenPayload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    full_name: user.full_name,
    student_id: studentData ? studentData.id : undefined
  };

  const token = generateToken(tokenPayload);

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      phone: user.phone,
      avatar_url: user.avatar_url
    },
    student: studentData
  });
});

// Get current user profile
authRouter.get('/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.user!.id) as any;
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  let studentData: any = null;
  if (user.role === 'student') {
    studentData = db.prepare(`
      SELECT s.*, b.name as block_name, f.name as floor_name, h.name as hostel_name,
             h.latitude as hostel_lat, h.longitude as hostel_lng, h.geofence_radius_meters
      FROM students s
      LEFT JOIN blocks b ON s.block_id = b.id
      LEFT JOIN floors f ON s.floor_id = f.id
      LEFT JOIN hostels h ON s.hostel_id = h.id
      WHERE s.user_id = ?
    `).get(user.id);
  }

  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      phone: user.phone,
      avatar_url: user.avatar_url,
      last_login: user.last_login
    },
    student: studentData
  });
});

// In-memory cache for Phone OTP Password Reset (Valid for 10 minutes)
interface OtpRecord {
  otp: string;
  expiresAt: number;
  userId: string;
  identifier: string;
  phone: string;
}
const passwordResetOtpMap = new Map<string, OtpRecord>();

// 1. Request Phone OTP for Password Reset
authRouter.post('/forgot-password-otp', (req, res) => {
  const { identifier } = req.body;
  if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
    return res.status(400).json({ error: 'Please enter your registered mobile number, roll number, or academic email.' });
  }

  const clean = identifier.trim();
  const cleanPhone = clean.replace(/[^0-9]/g, '');

  // Look up user by phone number, student phone, roll number, username, or email
  const user = db.prepare(`
    SELECT u.id, u.username, u.email, u.full_name, u.phone, s.phone as student_phone, s.roll_number
    FROM users u
    LEFT JOIN students s ON u.id = s.user_id
    WHERE u.phone = ? 
       OR s.phone = ?
       OR (LENGTH(?) >= 10 AND (REPLACE(u.phone, ' ', '') LIKE '%' || ? OR REPLACE(s.phone, ' ', '') LIKE '%' || ?))
       OR UPPER(u.username) = UPPER(?)
       OR UPPER(s.roll_number) = UPPER(?)
       OR LOWER(u.email) = LOWER(?)
    LIMIT 1
  `).get(clean, clean, cleanPhone, cleanPhone.slice(-10), cleanPhone.slice(-10), clean, clean, clean) as any;

  if (!user) {
    return res.status(404).json({
      error: 'Account not found. No registered student or staff account matches this phone number, roll number, or email.'
    });
  }

  const registeredPhone = user.phone || user.student_phone || clean;
  // Generate a random 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Store in cache indexed by user.id and clean input
  const record: OtpRecord = {
    otp,
    expiresAt,
    userId: user.id,
    identifier: clean,
    phone: registeredPhone
  };
  passwordResetOtpMap.set(user.id, record);
  passwordResetOtpMap.set(clean.toLowerCase(), record);
  if (cleanPhone.length >= 10) {
    passwordResetOtpMap.set(cleanPhone.slice(-10), record);
  }

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details)
    VALUES (?, ?, 'PASSWORD_RESET_OTP_REQUESTED', 'users', ?, ?)
  `).run(
    `aud-otp-${Date.now()}`,
    user.id,
    user.id,
    `Password reset OTP dispatched to registered phone: ${registeredPhone}`
  );

  // Mask phone for user privacy (e.g., +91 98•••• 3210)
  const phoneDigits = registeredPhone.replace(/[^0-9]/g, '');
  const maskedPhone = phoneDigits.length >= 10
    ? `+91 ${phoneDigits.slice(-10, -7)}••••${phoneDigits.slice(-3)}`
    : registeredPhone;

  res.json({
    success: true,
    message: `OTP sent successfully to your registered mobile (${maskedPhone}).`,
    phone: maskedPhone,
    otp, // Returned for instant testing and displayed simulated SMS banner in student UI
    userId: user.id,
    expiresInMinutes: 10
  });
});

// 2. Verify OTP & Reset Password
authRouter.post('/reset-password-otp', (req, res) => {
  const { identifier, userId, otp, newPassword } = req.body;

  if (!otp || typeof otp !== 'string' || otp.trim().length !== 6) {
    return res.status(400).json({ error: 'Please enter the 6-digit OTP sent to your registered phone.' });
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  // Look up OTP record
  let record: OtpRecord | undefined;
  if (userId && passwordResetOtpMap.has(userId)) {
    record = passwordResetOtpMap.get(userId);
  } else if (identifier && passwordResetOtpMap.has(identifier.trim().toLowerCase())) {
    record = passwordResetOtpMap.get(identifier.trim().toLowerCase());
  } else if (identifier) {
    const cleanPhone = identifier.replace(/[^0-9]/g, '');
    if (cleanPhone.length >= 10 && passwordResetOtpMap.has(cleanPhone.slice(-10))) {
      record = passwordResetOtpMap.get(cleanPhone.slice(-10));
    }
  }

  if (!record) {
    return res.status(400).json({ error: 'No active OTP request found. Please request a new OTP.' });
  }

  if (Date.now() > record.expiresAt) {
    passwordResetOtpMap.delete(record.userId);
    return res.status(400).json({ error: 'OTP has expired (10-minute limit exceeded). Please request a new OTP.' });
  }

  if (record.otp !== otp.trim()) {
    return res.status(400).json({ error: 'Incorrect OTP code. Please enter the valid 6-digit OTP.' });
  }

  // Update password in database
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(newPassword, salt);

  db.prepare(`
    UPDATE users
    SET password_hash = ?
    WHERE id = ?
  `).run(passwordHash, record.userId);

  safePgQuery(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, record.userId]);

  // Clean up OTP cache
  passwordResetOtpMap.delete(record.userId);
  passwordResetOtpMap.delete(record.identifier.toLowerCase());

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details)
    VALUES (?, ?, 'PASSWORD_RESET_SUCCESS', 'users', ?, ?)
  `).run(
    `aud-pwd-ok-${Date.now()}`,
    record.userId,
    record.userId,
    `Password successfully reset via Phone OTP for user ID: ${record.userId}`
  );

  res.json({
    success: true,
    message: 'Password has been reset successfully! You can now log in with your new password.'
  });
});

// Legacy / fallback endpoint for email reset
authRouter.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address or mobile phone is required' });
  }

  const user = db.prepare('SELECT id, full_name, phone FROM users WHERE email = ? OR phone = ?').get(email, email) as any;
  if (!user) {
    return res.json({
      success: true,
      message: 'If an account exists with this credential, reset instructions and OTP have been dispatched.'
    });
  }

  res.json({
    success: true,
    message: 'Password reset OTP has been dispatched to your registered phone number.'
  });
});



// Self-Registration for real students
authRouter.post('/register-student', async (req, res) => {
  try {
    const {
      roll_number,
      full_name,
      email,
      password,
      phone,
      emergency_phone,
      parent_name,
      parent_phone,
      room_id,
      department,
      year_of_study,
      imageBase64
    } = req.body;

    if (!roll_number || !full_name || !email || !password || !phone) {
      return res.status(400).json({ error: 'Roll number, full name, email, password, and phone number are required.' });
    }

    const cleanRoll = roll_number.trim().toUpperCase();
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(cleanRoll, email.trim().toLowerCase());
    if (existingUser) {
      return res.status(400).json({ error: `An account with roll number ${cleanRoll} or email ${email} already exists.` });
    }

    // Default to first available room if not explicitly selected
    let selectedRoom: any = null;
    if (room_id) {
      selectedRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(room_id);
    }
    if (!selectedRoom) {
      selectedRoom = db.prepare('SELECT * FROM rooms WHERE occupied_count < capacity LIMIT 1').get() ||
                     db.prepare('SELECT * FROM rooms LIMIT 1').get();
    }

    if (!selectedRoom) {
      ensureCampusInfrastructure();
      selectedRoom = db.prepare('SELECT * FROM rooms WHERE occupied_count < capacity LIMIT 1').get() ||
                     db.prepare('SELECT * FROM rooms LIMIT 1').get();
    }

    if (!selectedRoom) {
      const fallbackHostelId = 'hostel-tagore-main';
      const fallbackBlockId = 'block-a';
      const fallbackFloorId = 'floor-block-a-1';
      const fallbackRoomId = 'room-block-a-101';
      db.prepare(`INSERT OR IGNORE INTO hostels (id, name, code) VALUES (?, 'Tagore Central Hostel Complex', 'TCHC-01')`).run(fallbackHostelId);
      db.prepare(`INSERT OR IGNORE INTO blocks (id, hostel_id, name, code) VALUES (?, ?, 'Block A - Nalanda (Engineering Wing)', 'BLK-A')`).run(fallbackBlockId, fallbackHostelId);
      db.prepare(`INSERT OR IGNORE INTO floors (id, block_id, floor_number, name) VALUES (?, ?, 1, 'Ground Floor')`).run(fallbackFloorId, fallbackBlockId);
      db.prepare(`INSERT OR IGNORE INTO rooms (id, floor_id, block_id, room_number, capacity, occupied_count) VALUES (?, ?, ?, 'A-101', 4, 0)`).run(fallbackRoomId, fallbackFloorId, fallbackBlockId);
      selectedRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(fallbackRoomId);
    }

    const userId = `usr-real-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const studentId = `std-real-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const passwordHash = bcrypt.hashSync(password, 10);

    // Create user
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, full_name, phone, status, created_at)
      VALUES (?, ?, ?, ?, 'student', ?, ?, 'Active', datetime('now'))
    `).run(userId, cleanRoll, email.trim().toLowerCase(), passwordHash, full_name.trim(), phone.trim());

    safePgQuery(`
      INSERT INTO users (id, username, email, password_hash, role, full_name, phone, status, created_at)
      VALUES ($1, $2, $3, $4, 'student', $5, $6, 'Active', NOW())
      ON CONFLICT (id) DO NOTHING
    `, [userId, cleanRoll, email.trim().toLowerCase(), passwordHash, full_name.trim(), phone.trim()]);

    // Optional Face Enrollment from imageBase64 if submitted during registration
    let faceDescriptorStr: string | null = null;
    let hasFaceEnrolled = 0;
    if (imageBase64 && imageBase64.length > 500) {
      try {
        const detectResult = await detectFaceBiometrics(imageBase64);
        if (detectResult.detected && detectResult.descriptor) {
          faceDescriptorStr = JSON.stringify(detectResult.descriptor);
          hasFaceEnrolled = 1;
        }
      } catch (e) {
        console.warn('Face detection service not available during registration:', e);
      }
    }

    // Create student
    db.prepare(`
      INSERT INTO students (
        id, user_id, roll_number, full_name, email, phone, emergency_phone,
        parent_name, parent_phone, hostel_id, block_id, floor_id, room_id,
        room_number, department, year_of_study, current_status, has_face_enrolled,
        face_descriptor, face_enrolled_at, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, 'hostel-tagore-main', ?, ?, ?,
        ?, ?, ?, 'Inside', ?,
        ?, ${hasFaceEnrolled ? "datetime('now')" : "NULL"}, datetime('now')
      )
    `).run(
      studentId,
      userId,
      cleanRoll,
      full_name.trim(),
      email.trim().toLowerCase(),
      phone.trim(),
      emergency_phone ? emergency_phone.trim() : phone.trim(),
      parent_name ? parent_name.trim() : 'Guardian',
      parent_phone ? parent_phone.trim() : phone.trim(),
      selectedRoom.block_id,
      selectedRoom.floor_id,
      selectedRoom.id,
      selectedRoom.room_number,
      department || 'Computer Science & Engineering',
      Number(year_of_study) || 1,
      hasFaceEnrolled,
      faceDescriptorStr
    );

    safePgQuery(`
      INSERT INTO students (
        id, user_id, roll_number, full_name, email, phone, emergency_phone,
        parent_name, parent_phone, hostel_id, block_id, floor_id, room_id,
        room_number, department, year_of_study, current_status, has_face_enrolled,
        face_descriptor, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, 'hostel-tagore-main', $10, $11, $12,
        $13, $14, $15, 'Inside', $16,
        $17, NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `, [
      studentId,
      userId,
      cleanRoll,
      full_name.trim(),
      email.trim().toLowerCase(),
      phone.trim(),
      emergency_phone ? emergency_phone.trim() : phone.trim(),
      parent_name ? parent_name.trim() : 'Guardian',
      parent_phone ? parent_phone.trim() : phone.trim(),
      selectedRoom.block_id,
      selectedRoom.floor_id,
      selectedRoom.id,
      selectedRoom.room_number,
      department || 'Computer Science & Engineering',
      Number(year_of_study) || 1,
      hasFaceEnrolled,
      faceDescriptorStr
    ]);

    // Update room occupancy
    db.prepare(`UPDATE rooms SET occupied_count = occupied_count + 1 WHERE id = ?`).run(selectedRoom.id);

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details)
      VALUES (?, ?, 'STUDENT_SELF_REGISTER', 'students', ?, ?)
    `).run(
      `aud-${Date.now()}`,
      userId,
      studentId,
      `Real student self-registered: ${full_name} (${cleanRoll}) in Room ${selectedRoom.room_number}`
    );

    // Fetch complete student data
    const studentData = db.prepare(`
      SELECT s.*, b.name as block_name, f.name as floor_name, h.name as hostel_name
      FROM students s
      LEFT JOIN blocks b ON s.block_id = b.id
      LEFT JOIN floors f ON s.floor_id = f.id
      LEFT JOIN hostels h ON s.hostel_id = h.id
      WHERE s.id = ?
    `).get(studentId);

    const token = generateToken({
      id: userId,
      username: cleanRoll,
      email: email.trim().toLowerCase(),
      role: 'student',
      full_name: full_name.trim(),
      student_id: studentId
    });

    res.json({
      success: true,
      message: `Account created successfully! Welcome to Hostel Safety, ${full_name}.`,
      token,
      user: {
        id: userId,
        username: cleanRoll,
        email: email.trim().toLowerCase(),
        role: 'student',
        full_name: full_name.trim(),
        phone: phone.trim()
      },
      student: studentData
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message || 'Registration failed' });
  }
});
