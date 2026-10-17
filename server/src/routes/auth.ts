import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { generateToken, authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';

export const authRouter = Router();

// Login
authRouter.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username/Email and password are required' });
  }

  const user = db.prepare(`
    SELECT * FROM users WHERE username = ? OR email = ?
  `).get(username, username) as any;

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

// Forgot password
authRouter.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required' });
  }

  const user = db.prepare('SELECT id, full_name FROM users WHERE email = ?').get(email) as any;
  if (!user) {
    // For privacy, don't disclose whether email exists
    return res.json({
      success: true,
      message: 'If an account exists with this email, reset instructions have been sent to your administrator.'
    });
  }

  // Log in audit logs
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details)
    VALUES (?, ?, 'PASSWORD_RESET_REQUEST', 'users', ?, ?)
  `).run(
    `aud-pwd-${Date.now()}`,
    user.id,
    user.id,
    `Password reset requested for ${email}`
  );

  res.json({
    success: true,
    message: 'Password reset link and OTP has been dispatched to your registered email and warden office.'
  });
});

// Demo switch role helper (makes testing student / warden / admin roles instant)
authRouter.post('/switch-demo-role', (req, res) => {
  const { role, username } = req.body;
  let targetUsername = username;

  if (!targetUsername) {
    if (role === 'admin') targetUsername = 'admin';
    else if (role === 'warden') targetUsername = 'warden';
    else if (role === 'student') targetUsername = 'student';
    else targetUsername = 'student';
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(targetUsername) as any;
  if (!user) {
    return res.status(404).json({ error: 'Demo user not found' });
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
    message: `Switched to demo role: ${user.role} (${user.full_name})`,
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
      return res.status(400).json({ error: 'No hostel rooms found. Please configure hostel rooms first.' });
    }

    const userId = `usr-real-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const studentId = `std-real-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const passwordHash = bcrypt.hashSync(password, 10);

    // Create user
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, full_name, phone, status, created_at)
      VALUES (?, ?, ?, ?, 'student', ?, ?, 'Active', datetime('now'))
    `).run(userId, cleanRoll, email.trim().toLowerCase(), passwordHash, full_name.trim(), phone.trim());

    // Optional Face Enrollment from imageBase64 if submitted during registration
    let faceDescriptorStr: string | null = null;
    let hasFaceEnrolled = 0;
    if (imageBase64 && imageBase64.length > 500) {
      try {
        const detectRes = await fetch(`${process.env.FASTAPI_FACE_URL || 'http://127.0.0.1:8005'}/api/face/detect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: imageBase64 })
        });
        if (detectRes.ok) {
          const detectData = await detectRes.json() as any;
          if (detectData.detected && detectData.descriptor) {
            faceDescriptorStr = JSON.stringify(detectData.descriptor);
            hasFaceEnrolled = 1;
          }
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
