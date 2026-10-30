import bcrypt from 'bcryptjs';
import { db, initDatabase } from './db.js';

// Realistic names generator
const FIRST_NAMES = [
  'Aarav', 'Aditi', 'Advait', 'Ananya', 'Arjun', 'Bhavya', 'Chetan', 'Devansh',
  'Diya', 'Eshan', 'Gaurav', 'Isha', 'Ishaan', 'Kavya', 'Karan', 'Khushi',
  'Manish', 'Meera', 'Neha', 'Nikhil', 'Pooja', 'Pranav', 'Priya', 'Rahul',
  'Riya', 'Rohan', 'Sakshi', 'Sameer', 'Sanya', 'Shreya', 'Siddharth', 'Sneha',
  'Tanvi', 'Utkarsh', 'Varun', 'Vidya', 'Vikram', 'Yash', 'Zoya', 'Aditya',
  'Kunal', 'Deepak', 'Swati', 'Harsh', 'Divya', 'Tanya', 'Ankit', 'Ritika'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Iyer', 'Patel', 'Singh', 'Kumar', 'Reddy',
  'Nair', 'Mehta', 'Kulkarni', 'Joshi', 'Chopra', 'Malhotra', 'Bose', 'Das',
  'Chatterjee', 'Sen', 'Menon', 'Pillai', 'Rao', 'Bhat', 'Agarwal', 'Pandey'
];

const DEPARTMENTS = [
  'Computer Science & Engg',
  'Electronics & Comm Engg',
  'Mechanical Engineering',
  'Electrical & Electronics',
  'Civil Engineering',
  'Information Technology',
  'Chemical Engineering',
  'Bioengineering'
];

export function seedData() {
  console.log('Starting seed process for 1,200 hostel students dataset...');
  initDatabase();

  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('admin123', salt);
  const wardenHash = bcrypt.hashSync('warden123', salt);
  const studentHash = bcrypt.hashSync('student123', salt);

  // Clear existing data cleanly in correct foreign key order
  db.exec(`
    DELETE FROM audit_logs;
    DELETE FROM notifications;
    DELETE FROM exception_alerts;
    DELETE FROM movement_records;
    DELETE FROM leave_requests;
    DELETE FROM attendance_records;
    DELETE FROM students;
    DELETE FROM users;
    DELETE FROM rooms;
    DELETE FROM floors;
    DELETE FROM blocks;
    DELETE FROM hostels;
  `);

  // 1. Create Hostel
  const hostelId = 'hostel-tagore-main';
  db.prepare(`
    INSERT INTO hostels (id, name, code, address, latitude, longitude, geofence_radius_meters)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    hostelId,
    'Tagore Central Hostel Complex',
    'TCHC-01',
    'Campus North Wing, Knowledge Park, Academic City',
    15.774299,
    78.054718,
    35
  );

  // 2. Create Blocks
  const blocksData = [
    { id: 'block-a', name: 'Block A - Annapurna', code: 'BLK-A', gender: 'Co-ed' },
    { id: 'block-b', name: 'Block B - Arundhati', code: 'BLK-B', gender: 'Co-ed' },
    { id: 'block-c', name: 'Block C - Anuradha', code: 'BLK-C', gender: 'Co-ed' }
  ];

  const insertBlock = db.prepare(`
    INSERT INTO blocks (id, hostel_id, name, code, gender, total_floors)
    VALUES (?, ?, ?, ?, ?, 4)
  `);
  for (const b of blocksData) {
    insertBlock.run(b.id, hostelId, b.name, b.code, b.gender);
  }

  // 3. Create Floors & Rooms (4 floors per block, 25 rooms per floor = 100 rooms per block, 300 rooms total)
  const insertFloor = db.prepare(`
    INSERT INTO floors (id, block_id, floor_number, name)
    VALUES (?, ?, ?, ?)
  `);

  const insertRoom = db.prepare(`
    INSERT INTO rooms (id, floor_id, block_id, room_number, capacity, occupied_count, status)
    VALUES (?, ?, ?, ?, 4, 4, 'Full')
  `);

  const allRoomIds: { id: string; blockId: string; floorId: string; roomNumber: string }[] = [];

  for (const b of blocksData) {
    for (let f = 1; f <= 4; f++) {
      const floorId = `floor-${b.id}-${f}`;
      const floorName = f === 1 ? 'Ground Floor' : `${f - 1}${f === 2 ? 'st' : f === 3 ? 'nd' : 'rd'} Floor`;
      insertFloor.run(floorId, b.id, f, floorName);

      for (let r = 1; r <= 25; r++) {
        const roomNum = `${b.code.slice(-1)}-${f * 100 + r}`;
        const roomId = `room-${b.id}-${f * 100 + r}`;
        insertRoom.run(roomId, floorId, b.id, roomNum);
        allRoomIds.push({ id: roomId, blockId: b.id, floorId, roomNumber: roomNum });
      }
    }
  }

  // 4. Create Administrative Staff & Wardens
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, email, password_hash, role, full_name, phone, avatar_url, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Admin
  insertUser.run(
    'usr-admin-01',
    'admin',
    'admin@hostelsafety.edu',
    adminHash,
    'admin',
    'Col. Sanjeev Deshmukh (Chief Administrator)',
    '+91 98110 22334',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    'Active'
  );

  // Chief Warden
  insertUser.run(
    'usr-warden-01',
    'warden',
    'warden@hostelsafety.edu',
    wardenHash,
    'warden',
    'Dr. Rajesh Verma (Chief Warden)',
    '+91 98220 44556',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    'Active'
  );

  // Block A Warden
  insertUser.run(
    'usr-warden-02',
    'warden_nalanda',
    'warden.nalanda@hostelsafety.edu',
    wardenHash,
    'warden',
    'Prof. Sunita Rao (Warden - Block A)',
    '+91 98330 66778',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    'Active'
  );

  // Block B Warden
  insertUser.run(
    'usr-warden-03',
    'warden_taksha',
    'warden.taksha@hostelsafety.edu',
    wardenHash,
    'warden',
    'Dr. Amit Kulkarni (Warden - Block B)',
    '+91 98440 88990',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    'Active'
  );

  // 5. Generate 1,200 Students
  console.log('Generating 1,200 students with room assignments and biometric profiles...');

  const insertStudent = db.prepare(`
    INSERT INTO students (
      id, user_id, roll_number, full_name, email, phone, emergency_phone,
      parent_name, parent_phone, hostel_id, block_id, floor_id, room_id,
      room_number, department, year_of_study, current_status, has_face_enrolled,
      face_descriptor, face_enrolled_at, attendance_exempt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, 0
    )
  `);

  const studentCount = 1200;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const studentsList: any[] = [];

  // Transaction for batch speed
  const insertManyStudents = db.transaction(() => {
    let roomIdx = 0;
    let bedInRoom = 0;

    for (let i = 1; i <= studentCount; i++) {
      const studentId = `std-${String(i).padStart(4, '0')}`;
      const userId = `usr-std-${String(i).padStart(4, '0')}`;
      const rollNumber = `2024CS${String(100 + i)}`;

      const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
      const lastName = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
      const fullName = (i === 1) ? 'Priya Sharma' :
                       (i === 2) ? 'Rahul Mehta' :
                       (i === 3) ? 'Rohan Gupta' :
                       (i === 4) ? 'Ananya Iyer' :
                       `${firstName} ${lastName}`;

      const username = (i === 1) ? 'student' :
                       (i === 2) ? 'student_out' :
                       (i === 3) ? 'student_overdue' :
                       (i === 4) ? 'student_leave' :
                       `std_${i}`;

      const email = `${username}@student.hostelsafety.edu`;
      const phone = `+91 98${String(10000000 + i).slice(-8)}`;
      const emergencyPhone = `+91 97${String(20000000 + i).slice(-8)}`;
      const parentName = `Mr. Ramesh ${lastName}`;
      const parentPhone = `+91 94${String(30000000 + i).slice(-8)}`;

      const roomInfo = allRoomIds[roomIdx];
      bedInRoom++;
      if (bedInRoom >= 4) {
        bedInRoom = 0;
        if (roomIdx < allRoomIds.length - 1) roomIdx++;
      }

      const dept = DEPARTMENTS[i % DEPARTMENTS.length];
      const year = (i % 4) + 1;

      // Realistic distribution:
      // i=2: Currently Outside (legitimate)
      // i=3: Overdue Outside
      // i=4: On approved leave
      // i % 25 === 0: On approved leave (~48 students)
      // i % 40 === 0: Currently outside (~30 students)
      // i % 120 === 0: Overdue outside (~10 students)
      let status = 'Inside';
      if (i === 2 || (i % 40 === 0 && i !== 3)) {
        status = 'Outside';
      } else if (i === 3 || (i % 120 === 0)) {
        status = 'Outside'; // Will have overdue movement record
      } else if (i === 4 || (i % 25 === 0)) {
        status = 'On Leave';
      }

      // Biometric face vector representation (normalized simulated 128-d embedding)
      const mockEmbedding = Array.from({ length: 32 }, (_, k) => Number((Math.sin(i * 10 + k) * 0.5 + 0.5).toFixed(4)));

      insertUser.run(
        userId,
        username,
        email,
        studentHash,
        'student',
        fullName,
        phone,
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${fullName}`,
        'Active'
      );

      insertStudent.run(
        studentId,
        userId,
        rollNumber,
        fullName,
        email,
        phone,
        emergencyPhone,
        parentName,
        parentPhone,
        hostelId,
        roomInfo.blockId,
        roomInfo.floorId,
        roomInfo.id,
        roomInfo.roomNumber,
        dept,
        year,
        status,
        1, // face enrolled
        JSON.stringify(mockEmbedding),
        '2026-08-01 10:00:00'
      );

      studentsList.push({
        id: studentId,
        userId,
        rollNumber,
        fullName,
        roomNumber: roomInfo.roomNumber,
        blockId: roomInfo.blockId,
        status,
        phone,
        parentPhone
      });
    }
  });

  insertManyStudents();

  // 6. Create Leave Requests and Movement Records
  console.log('Seeding leave requests and movement records...');

  const insertLeave = db.prepare(`
    INSERT INTO leave_requests (
      id, student_id, leave_type, reason, destination, departure_date,
      expected_return_date, status, parent_informed, parent_consent_phone,
      warden_remarks, reviewed_by_user_id, reviewed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
  `);

  const insertMovement = db.prepare(`
    INSERT INTO movement_records (
      id, student_id, leave_request_id, movement_type, status,
      actual_departure_time, expected_return_time, actual_return_time,
      departure_gate, return_gate, is_overdue, overdue_minutes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Student 1: Priya Sharma (Demo student) - has a past approved leave and returned movement
  insertLeave.run(
    'leave-001',
    'std-0001',
    'Outing',
    'Library research and book purchase at Connaught Place',
    'City Central Library',
    '2026-10-12 14:00',
    '2026-10-12 19:00',
    'Approved',
    '+91 9430000001',
    'Approved. Ensure return before evening roll call.',
    'usr-warden-01',
    '2026-10-12 11:30',
    '2026-10-12 10:00'
  );

  insertMovement.run(
    'mov-001',
    'std-0001',
    'leave-001',
    'Outing',
    'Returned',
    '2026-10-12 14:15',
    '2026-10-12 19:00',
    '2026-10-12 18:40',
    'Main Campus Gate A',
    'Main Campus Gate A',
    0,
    0,
    '2026-10-12 14:15'
  );

  // Student 2: Rahul Mehta (Currently Outside - Legitimate)
  insertLeave.run(
    'leave-002',
    'std-0002',
    'Outing',
    'Medical consultation at AIIMS Hospital',
    'AIIMS Campus Clinic',
    `${todayStr} 15:00`,
    `${todayStr} 21:00`,
    'Approved',
    '+91 9430000002',
    'Approved on medical grounds.',
    'usr-warden-01',
    `${todayStr} 12:00`,
    `${todayStr} 11:00`
  );

  insertMovement.run(
    'mov-002',
    'std-0002',
    'leave-002',
    'Outing',
    'Outside',
    `${todayStr} 15:10`,
    `${todayStr} 21:00`,
    null,
    'North Gate B',
    null,
    0,
    0,
    `${todayStr} 15:10`
  );

  // Student 3: Rohan Gupta (Overdue Outside - Expected return was 2 hours ago!)
  const overdueTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 16);
  const departureTime = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 16);

  insertLeave.run(
    'leave-003',
    'std-0003',
    'Outing',
    'Project group study at University Tech Park',
    'DLF Cyber City',
    departureTime,
    overdueTime,
    'Approved',
    '+91 9430000003',
    'Approved. Please return promptly by scheduled time.',
    'usr-warden-02',
    departureTime,
    departureTime
  );

  insertMovement.run(
    'mov-003',
    'std-0003',
    'leave-003',
    'Outing',
    'Overdue',
    departureTime,
    overdueTime,
    null,
    'Main Campus Gate A',
    null,
    1,
    120,
    departureTime
  );

  // Student 4: Ananya Iyer (On approved Home Leave for 3 days)
  insertLeave.run(
    'leave-004',
    'std-0004',
    'Home Leave',
    'Family festival celebration (Diwali holidays)',
    'Bengaluru, Karnataka',
    '2026-10-14 09:00',
    '2026-10-18 20:00',
    'Approved',
    '+91 9430000004',
    'Home leave granted. Parent verbal confirmation received.',
    'usr-warden-01',
    '2026-10-13 16:00',
    '2026-10-13 10:00'
  );

  insertMovement.run(
    'mov-004',
    'std-0004',
    'leave-004',
    'Home Leave',
    'Outside',
    '2026-10-14 09:30',
    '2026-10-18 20:00',
    null,
    'Main Campus Gate A',
    null,
    0,
    0,
    '2026-10-14 09:30'
  );

  // 8 Pending Leave Requests for Warden Approval Queue
  const pendingLeaves = [
    { stdId: 'std-0005', type: 'Night Out', reason: 'Hackathon HackMIT local node participation at IIT Delhi', dest: 'IIT Delhi Campus', dep: `${todayStr} 18:00`, ret: '2026-10-16 08:00' },
    { stdId: 'std-0006', type: 'Outing', reason: 'Essential prescription medicine collection and dental clinic', dest: 'City Care Hospital', dep: `${todayStr} 16:30`, ret: `${todayStr} 20:30` },
    { stdId: 'std-0007', type: 'Home Leave', reason: 'Brother wedding ceremony', dest: 'Jaipur, Rajasthan', dep: '2026-10-17 07:00', ret: '2026-10-21 21:00' },
    { stdId: 'std-0008', type: 'Outing', reason: 'GRE test prep center physical mock exam', dest: 'Manya Princeton Review, Sector 18', dep: `${todayStr} 15:00`, ret: `${todayStr} 19:30` },
    { stdId: 'std-0009', type: 'Academic Visit', reason: 'Conference presentation at IEEE Robotics Summit', dest: 'Vigyan Bhawan, New Delhi', dep: '2026-10-18 08:00', ret: '2026-10-19 19:00' },
    { stdId: 'std-0010', type: 'Outing', reason: 'Bank KYC verification and document submission', dest: 'State Bank of India University Branch', dep: `${todayStr} 14:00`, ret: `${todayStr} 18:00` },
    { stdId: 'std-0011', type: 'Night Out', reason: 'Relatives residence dinner visit with family approval', dest: 'Vasant Kunj, New Delhi', dep: `${todayStr} 19:00`, ret: '2026-10-16 07:30' },
    { stdId: 'std-0012', type: 'Emergency/Medical', reason: 'Urgent ophthalmology checkup for sudden eye allergy', dest: 'Centre for Sight Eye Hospital', dep: `${todayStr} 14:30`, ret: `${todayStr} 19:00` }
  ];

  pendingLeaves.forEach((p, idx) => {
    insertLeave.run(
      `leave-pending-${idx + 1}`,
      p.stdId,
      p.type,
      p.reason,
      p.dest,
      p.dep,
      p.ret,
      'Pending',
      '+91 9899011223',
      null,
      null,
      null,
      `${todayStr} 09:${10 + idx * 5}`
    );
  });

  // Additional 8 Overdue Movements for realistic Warden Attention Required Queue
  const overdueStudents = [
    { stdId: 'std-0120', name: 'Vikram Das', room: 'BLK-A-201', hoursAgo: 3, dest: 'Sector 62 Market' },
    { stdId: 'std-0240', name: 'Kunal Joshi', room: 'BLK-A-312', hoursAgo: 4, dest: 'City Central Station' },
    { stdId: 'std-0360', name: 'Harsh Chopra', room: 'BLK-B-115', hoursAgo: 2, dest: 'Sports Complex Arena' },
    { stdId: 'std-0480', name: 'Aditya Pillai', room: 'BLK-B-220', hoursAgo: 5, dest: 'Connaught Place' },
    { stdId: 'std-0600', name: 'Deepak Sen', room: 'BLK-B-405', hoursAgo: 1, dest: 'Metro Mall' },
    { stdId: 'std-0720', name: 'Ankit Rao', room: 'BLK-C-108', hoursAgo: 6, dest: 'Noida City Center' },
    { stdId: 'std-0840', name: 'Siddharth Bose', room: 'BLK-C-215', hoursAgo: 3, dest: 'Botanical Garden' }
  ];

  overdueStudents.forEach((ov, idx) => {
    const expTime = new Date(Date.now() - ov.hoursAgo * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 16);
    const depTime = new Date(Date.now() - (ov.hoursAgo + 4) * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 16);

    insertLeave.run(
      `leave-ov-${idx + 1}`,
      ov.stdId,
      'Outing',
      `Personal visit to ${ov.dest}`,
      ov.dest,
      depTime,
      expTime,
      'Approved',
      '+91 9811002233',
      'Approved by duty warden.',
      'usr-warden-01',
      depTime,
      depTime
    );

    insertMovement.run(
      `mov-ov-${idx + 1}`,
      ov.stdId,
      `leave-ov-${idx + 1}`,
      'Outing',
      'Overdue',
      depTime,
      expTime,
      null,
      'Main Campus Gate A',
      null,
      1,
      ov.hoursAgo * 60,
      depTime
    );
  });

  // 7. Create Actionable Exception Alerts
  console.log('Seeding exception alerts for Warden Attention Required Queue...');

  const insertException = db.prepare(`
    INSERT INTO exception_alerts (
      id, student_id, type, severity, status, title, description, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Overdue exceptions
  insertException.run(
    'exp-001',
    'std-0003',
    'OVERDUE_RETURN',
    'Critical',
    'Open',
    'Return Overdue: Rohan Gupta (Room A-205) is 120 mins overdue',
    'Student left at ' + departureTime + ' with expected return at ' + overdueTime + ' (DLF Cyber City). No return signal received. Contact parent or emergency phone.',
    overdueTime
  );

  overdueStudents.forEach((ov, idx) => {
    insertException.run(
      `exp-ov-${idx + 1}`,
      ov.stdId,
      'OVERDUE_RETURN',
      ov.hoursAgo >= 4 ? 'Critical' : 'High',
      'Open',
      `Return Overdue: ${ov.name} (${ov.room}) is ${ov.hoursAgo * 60} mins overdue`,
      `Approved destination: ${ov.dest}. Curfew exceeded without gate check-in or return notification.`,
      new Date(Date.now() - ov.hoursAgo * 60 * 60 * 1000).toISOString()
    );
  });

  // Additional realistic administrative exceptions
  insertException.run(
    'exp-010',
    'std-0015',
    'VERIFICATION_FAILED',
    'Medium',
    'Open',
    'Face Biometric Mismatch: Multiple failed attempts (Tanvi Verma)',
    'Camera captured image similarity score 0.38 was below the 0.70 threshold. Review image capture in student logs or schedule manual ID check.',
    `${todayStr} 20:45:00`
  );

  insertException.run(
    'exp-011',
    'std-0022',
    'INVALID_LOCATION',
    'High',
    'Open',
    'Geofence Discrepancy: Attendance submitted from outside campus boundary',
    'Student Nitin Pillai submitted evening attendance from 1.8 km outside the Tagore Hostel geofence (28.5612, 77.2104).',
    `${todayStr} 21:15:00`
  );

  insertException.run(
    'exp-012',
    'std-0035',
    'ATTENDANCE_NOT_SUBMITTED',
    'High',
    'Open',
    'Curfew Missing: Attendance not submitted by 21:30 deadline',
    'Student Yash Chopra (Room B-204) has not submitted evening curfew attendance and has no approved leave on file.',
    `${todayStr} 21:40:00`
  );

  // 8. Create Attendance Records for Past 7 Days (for Trend Charts and Reports)
  console.log('Seeding realistic attendance history for past 7 days across all blocks...');

  const insertAttendance = db.prepare(`
    INSERT INTO attendance_records (
      id, student_id, date, session_name, status, verification_method,
      confidence_score, liveness_verified, location_verified, latitude,
      longitude, distance_from_hostel_meters, timestamp
    ) VALUES (?, ?, ?, 'Evening Curfew Check', ?, 'Face + Geolocation', ?, 1, 1, 28.5451, 77.1925, 45.2, ?)
  `);

  const insertManyAttendance = db.transaction(() => {
    // Generate for the first 150 students across all 7 days for rich test reports and charts
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const d = new Date(Date.now() - dayOffset * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];

      for (let s = 1; s <= 200; s++) {
        const student = studentsList[s - 1];
        let status = 'Present';
        let conf = 0.92;

        if (s % 33 === 0) {
          status = 'Absent';
          conf = 0.0;
        } else if (s % 45 === 0) {
          status = 'Verification Failed';
          conf = 0.42;
        } else if (student.status === 'On Leave') {
          status = 'Excused';
          conf = 1.0;
        }

        insertAttendance.run(
          `att-${dateStr}-${student.id}`,
          student.id,
          dateStr,
          status,
          conf,
          `${dateStr} 20:${String((s % 45) + 10).padStart(2, '0')}:15`
        );
      }
    }
  });

  insertManyAttendance();

  // 9. Create Notifications
  const insertNotification = db.prepare(`
    INSERT INTO notifications (id, user_id, student_id, title, message, type, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertNotification.run(
    'notif-001',
    'usr-std-0001',
    'std-0001',
    'Curfew Reminder: Evening Roll Call',
    'Please complete your Face Recognition & Location attendance before 21:30 hrs tonight.',
    'attendance_reminder',
    0,
    `${todayStr} 19:00:00`
  );

  insertNotification.run(
    'notif-002',
    'usr-std-0001',
    'std-0001',
    'Leave Request Approved',
    'Your outing request for City Central Library was approved by Dr. Rajesh Verma.',
    'leave_approved',
    1,
    '2026-10-12 11:30:00'
  );

  insertNotification.run(
    'notif-003',
    'usr-warden-01',
    null,
    'Urgent: 8 Students Overdue for Hostel Return',
    '8 students have exceeded their approved return deadlines by over 60 minutes. Immediate action advised.',
    'overdue_alert',
    0,
    `${todayStr} 21:45:00`
  );

  // 10. Audit Logs
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, user_id, action, target_type, target_id, details, ip_address, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertAudit.run('aud-001', 'usr-warden-01', 'APPROVE_LEAVE', 'leave_requests', 'leave-001', 'Approved Outing for Priya Sharma (2024CS101)', '10.20.1.15', '2026-10-12 11:30:00');
  insertAudit.run('aud-002', 'usr-warden-01', 'APPROVE_LEAVE', 'leave_requests', 'leave-002', 'Approved Medical Outing for Rahul Mehta (2024CS102)', '10.20.1.15', `${todayStr} 12:00:00`);
  insertAudit.run('aud-003', 'usr-admin-01', 'UPDATE_SETTINGS', 'system_settings', 'geofence_radius_meters', 'Updated geofence radius to 250 meters', '10.20.1.5', `${todayStr} 08:30:00`);

  console.log('Seeding completed successfully!');
  console.log(`- 1 Hostel, 3 Blocks, 12 Floors, 300 Rooms`);
  console.log(`- 1,200 Students created and mapped to rooms`);
  console.log(`- 4 Key Staff / Warden accounts seeded`);
  console.log(`- Active Movements, Pending Leaves, Overdues & Exceptions seeded`);
}

// Direct execution
seedData();

