import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, ensureCampusInfrastructure } from '../db.js';
import { generateToken, authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { detectFaceBiometrics } from '../utils/faceClient.js';
import { safePgQuery } from '../postgres.js';
import { sendPasswordResetEmail } from '../utils/emailService.js';

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

// In-memory cache for Gmail OTP Password Reset (Valid for 10 minutes)
interface OtpRecord {
  otp: string;
  expiresAt: number;
  userId: string;
  identifier: string;
  email: string;
  phone?: string;
}
const passwordResetOtpMap = new Map<string, OtpRecord>();

// 1. Request Gmail OTP for Password Reset
authRouter.post('/forgot-password-otp', async (req, res) => {
  const { identifier } = req.body;
  if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
    return res.status(400).json({ error: 'Please enter your registered Gmail or academic email address, or roll number.' });
  }

  const clean = identifier.trim();
  const cleanPhone = clean.replace(/[^0-9]/g, '');

  // Look up user by email, roll number, username, or phone
  const user = db.prepare(`
    SELECT u.id, u.username, u.email, u.full_name, u.phone, s.phone as student_phone, s.roll_number, s.email as student_email
    FROM users u
    LEFT JOIN students s ON u.id = s.user_id
    WHERE LOWER(u.email) = LOWER(?)
       OR LOWER(s.email) = LOWER(?)
       OR UPPER(u.username) = UPPER(?)
       OR UPPER(s.roll_number) = UPPER(?)
       OR u.phone = ? 
       OR s.phone = ?
       OR (LENGTH(?) >= 10 AND (REPLACE(u.phone, ' ', '') LIKE '%' || ? OR REPLACE(s.phone, ' ', '') LIKE '%' || ?))
    LIMIT 1
  `).get(clean, clean, clean, clean, clean, clean, cleanPhone, cleanPhone.slice(-10), cleanPhone.slice(-10)) as any;

  if (!user) {
    return res.status(404).json({
      error: 'Account not found. No registered student or staff account matches this Gmail address, roll number, or username.'
    });
  }

  const targetEmail = user.email || user.student_email;
  if (!targetEmail) {
    return res.status(400).json({ error: 'No email address registered for this account.' });
  }

  // Generate a random 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Store in cache indexed by user.id and clean input and email
  const record: OtpRecord = {
    otp,
    expiresAt,
    userId: user.id,
    identifier: clean,
    email: targetEmail,
    phone: user.phone || user.student_phone
  };
  passwordResetOtpMap.set(user.id, record);
  passwordResetOtpMap.set(clean.toLowerCase(), record);
  passwordResetOtpMap.set(targetEmail.toLowerCase(), record);

  // Send real password reset email via Gmail / SMTP transporter
  await sendPasswordResetEmail({
    toEmail: targetEmail,
    recipientName: user.full_name || user.username,
    otp,
    expiresInMinutes: 10
  });

  // Audit log
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details)
    VALUES (?, ?, 'PASSWORD_RESET_EMAIL_REQUESTED', 'users', ?, ?)
  `).run(
    `aud-otp-${Date.now()}`,
    user.id,
    user.id,
    `Password reset verification code emailed to Gmail: ${targetEmail}`
  );

  // Mask email for user privacy (e.g., s•••••••@gmail.com)
  const [localPart, domainPart] = targetEmail.split('@');
  const maskedLocal = localPart.length <= 2
    ? localPart[0] + '•••'
    : localPart[0] + '•'.repeat(Math.max(3, localPart.length - 2)) + localPart.slice(-1);
  const maskedEmail = `${maskedLocal}@${domainPart || 'gmail.com'}`;

  res.json({
    success: true,
    message: `Password reset verification code sent to your Gmail (${maskedEmail}). Please check your inbox and spam folder.`,
    email: maskedEmail,
    fullEmail: targetEmail,
    otp, // Returned for instant testing and displayed simulated inbox banner in student UI
    userId: user.id,
    expiresInMinutes: 10
  });
});

// 2. Verify OTP & Reset Password
authRouter.post('/reset-password-otp', (req, res) => {
  const { identifier, userId, otp, newPassword } = req.body;

  if (!otp || typeof otp !== 'string' || otp.trim().length !== 6) {
    return res.status(400).json({ error: 'Please enter the 6-digit verification code sent to your Gmail inbox.' });
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
    `Password successfully reset via Gmail verification for user ID: ${record.userId}`
  );

  res.json({
    success: true,
    message: 'Password has been reset successfully! You can now log in with your new password.'
  });
});

// Legacy / fallback endpoint for email reset
authRouter.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Gmail address or academic email is required' });
  }

  const user = db.prepare('SELECT id, full_name, email, phone FROM users WHERE LOWER(email) = LOWER(?)').get(email) as any;
  if (user) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    passwordResetOtpMap.set(user.id, {
      otp,
      expiresAt,
      userId: user.id,
      identifier: email,
      email: user.email
    });
    await sendPasswordResetEmail({
      toEmail: user.email,
      recipientName: user.full_name,
      otp
    });
  }

  res.json({
    success: true,
    message: 'If an account exists with this Gmail address, password reset instructions and OTP have been dispatched to your inbox.'
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
      block_id,
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

    // Assign room in selected block (Block A - Annapurna, Block B - Arundhati, Block C - Anuradha)
    const targetBlockId = block_id || 'block-a';
    let selectedRoom: any = null;
    if (room_id) {
      selectedRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(room_id);
    }
    if (!selectedRoom && targetBlockId) {
      selectedRoom = db.prepare('SELECT * FROM rooms WHERE block_id = ? AND occupied_count < capacity LIMIT 1').get(targetBlockId) ||
                     db.prepare('SELECT * FROM rooms WHERE block_id = ? LIMIT 1').get(targetBlockId);
    }
    if (!selectedRoom) {
      selectedRoom = db.prepare('SELECT * FROM rooms WHERE occupied_count < capacity LIMIT 1').get() ||
                     db.prepare('SELECT * FROM rooms LIMIT 1').get();
    }

    if (!selectedRoom) {
      ensureCampusInfrastructure();
      selectedRoom = (targetBlockId ? db.prepare('SELECT * FROM rooms WHERE block_id = ? AND occupied_count < capacity LIMIT 1').get(targetBlockId) : null) ||
                     db.prepare('SELECT * FROM rooms WHERE occupied_count < capacity LIMIT 1').get() ||
                     db.prepare('SELECT * FROM rooms LIMIT 1').get();
    }

    if (!selectedRoom) {
      const fallbackHostelId = 'hostel-tagore-main';
      const fallbackBlockId = targetBlockId || 'block-a';
      const fallbackFloorId = `floor-${fallbackBlockId}-1`;
      const fallbackRoomId = `room-${fallbackBlockId}-101`;
      db.prepare(`INSERT OR IGNORE INTO hostels (id, name, code) VALUES (?, 'Tagore Central Hostel Complex', 'TCHC-01')`).run(fallbackHostelId);
      db.prepare(`INSERT OR IGNORE INTO blocks (id, hostel_id, name, code) VALUES (?, ?, 'Block A - Annapurna', 'BLK-A')`).run(fallbackBlockId, fallbackHostelId);
      db.prepare(`INSERT OR IGNORE INTO floors (id, block_id, floor_number, name) VALUES (?, ?, 1, 'Ground Floor')`).run(fallbackFloorId, fallbackBlockId);
      db.prepare(`INSERT OR IGNORE INTO rooms (id, floor_id, block_id, room_number, capacity, occupied_count) VALUES (?, ?, ?, 'A-101', 4, 0)`).run(fallbackRoomId, fallbackFloorId, fallbackBlockId);
      selectedRoom = db.prepare('SELECT * FROM rooms WHERE id = ?').get(fallbackRoomId);
    }

    const userId = `usr-real-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const studentId = `std-real-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const passwordHash = bcrypt.hashSync(password, 10);

    // Optional photo and face enrollment from imageBase64
    let photoUrl: string | null = null;
    let faceDescriptorStr: string | null = null;
    let hasFaceEnrolled = 0;

    if (imageBase64 && imageBase64.length > 50) {
      photoUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
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

    // Create user with avatar_url
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, full_name, phone, avatar_url, status, created_at)
      VALUES (?, ?, ?, ?, 'student', ?, ?, ?, 'Active', datetime('now'))
    `).run(userId, cleanRoll, email.trim().toLowerCase(), passwordHash, full_name.trim(), phone.trim(), photoUrl);

    safePgQuery(`
      INSERT INTO users (id, username, email, password_hash, role, full_name, phone, avatar_url, status, created_at)
      VALUES ($1, $2, $3, $4, 'student', $5, $6, $7, 'Active', NOW())
      ON CONFLICT (id) DO UPDATE SET avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url)
    `, [userId, cleanRoll, email.trim().toLowerCase(), passwordHash, full_name.trim(), phone.trim(), photoUrl]);

    // Create student with photo_url
    db.prepare(`
      INSERT INTO students (
        id, user_id, roll_number, full_name, email, phone, emergency_phone,
        parent_name, parent_phone, hostel_id, block_id, floor_id, room_id,
        room_number, department, year_of_study, current_status, has_face_enrolled,
        face_descriptor, face_enrolled_at, photo_url, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, 'hostel-tagore-main', ?, ?, ?,
        ?, ?, ?, 'Inside', ?,
        ?, ${hasFaceEnrolled ? "datetime('now')" : "NULL"}, ?, datetime('now')
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
      faceDescriptorStr,
      photoUrl
    );

    safePgQuery(`
      INSERT INTO students (
        id, user_id, roll_number, full_name, email, phone, emergency_phone,
        parent_name, parent_phone, hostel_id, block_id, floor_id, room_id,
        room_number, department, year_of_study, current_status, has_face_enrolled,
        face_descriptor, photo_url, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, 'hostel-tagore-main', $10, $11, $12,
        $13, $14, $15, 'Inside', $16,
        $17, $18, NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        photo_url = COALESCE(EXCLUDED.photo_url, students.photo_url),
        face_descriptor = COALESCE(EXCLUDED.face_descriptor, students.face_descriptor),
        has_face_enrolled = EXCLUDED.has_face_enrolled
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
      faceDescriptorStr,
      photoUrl
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
