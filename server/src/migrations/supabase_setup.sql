-- ======================================================================
-- Supabase Schema & Initial Data Migration for Hostel Safety System
-- Paste this entire script into your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/hubvdfqtqmtfmvczvacy/sql/new
-- And click "Run" (green button)
-- ======================================================================

-- 1. Create Core Infrastructure Tables
CREATE TABLE IF NOT EXISTS hostels (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64) NOT NULL UNIQUE,
    address TEXT,
    latitude NUMERIC(10, 6) DEFAULT 15.774299,
    longitude NUMERIC(10, 6) DEFAULT 78.054718,
    geofence_radius_meters INTEGER DEFAULT 35,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blocks (
    id VARCHAR(64) PRIMARY KEY,
    hostel_id VARCHAR(64) REFERENCES hostels(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64) NOT NULL,
    gender VARCHAR(32) DEFAULT 'Co-ed',
    total_floors INTEGER DEFAULT 4,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS floors (
    id VARCHAR(64) PRIMARY KEY,
    block_id VARCHAR(64) REFERENCES blocks(id) ON DELETE CASCADE,
    floor_number INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
    id VARCHAR(64) PRIMARY KEY,
    floor_id VARCHAR(64) REFERENCES floors(id) ON DELETE CASCADE,
    block_id VARCHAR(64) REFERENCES blocks(id) ON DELETE CASCADE,
    room_number VARCHAR(64) NOT NULL,
    capacity INTEGER DEFAULT 4,
    occupied_count INTEGER DEFAULT 0,
    status VARCHAR(32) DEFAULT 'Available',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(128) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK(role IN ('student', 'warden', 'admin')),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(64),
    avatar_url TEXT,
    status VARCHAR(32) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS students (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    roll_number VARCHAR(64) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(64) NOT NULL,
    emergency_phone VARCHAR(64) NOT NULL,
    parent_name VARCHAR(255) NOT NULL,
    parent_phone VARCHAR(64) NOT NULL,
    hostel_id VARCHAR(64) REFERENCES hostels(id),
    block_id VARCHAR(64) REFERENCES blocks(id),
    floor_id VARCHAR(64) REFERENCES floors(id),
    room_id VARCHAR(64) REFERENCES rooms(id),
    room_number VARCHAR(64) NOT NULL,
    department VARCHAR(128) NOT NULL,
    year_of_study INTEGER NOT NULL,
    current_status VARCHAR(32) DEFAULT 'Inside' CHECK(current_status IN ('Inside', 'Outside', 'On Leave', 'Unknown')),
    has_face_enrolled INTEGER DEFAULT 0,
    face_descriptor TEXT,
    face_enrolled_at TIMESTAMPTZ,
    photo_url TEXT,
    attendance_exempt INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance_records (
    id VARCHAR(64) PRIMARY KEY,
    student_id VARCHAR(64) REFERENCES students(id) ON DELETE CASCADE,
    date VARCHAR(32) NOT NULL,
    session_name VARCHAR(128) DEFAULT 'Evening Curfew Check',
    status VARCHAR(32) NOT NULL CHECK(status IN ('Present', 'Absent', 'Verification Failed', 'Excused', 'Late')),
    verification_method VARCHAR(128) DEFAULT 'Face + Geolocation',
    confidence_score NUMERIC(5, 4),
    liveness_verified INTEGER DEFAULT 1,
    location_verified INTEGER DEFAULT 1,
    latitude NUMERIC(10, 6),
    longitude NUMERIC(10, 6),
    distance_from_hostel_meters NUMERIC(10, 2),
    verification_signals TEXT,
    failure_reason TEXT,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    verified_by_user_id VARCHAR(64)
);

CREATE TABLE IF NOT EXISTS leave_requests (
    id VARCHAR(64) PRIMARY KEY,
    student_id VARCHAR(64) REFERENCES students(id) ON DELETE CASCADE,
    leave_type VARCHAR(64) NOT NULL CHECK(leave_type IN ('Outing', 'Night Out', 'Home Leave', 'Emergency/Medical', 'Academic Visit')),
    reason TEXT NOT NULL,
    destination VARCHAR(255) NOT NULL,
    departure_date VARCHAR(64) NOT NULL,
    expected_return_date VARCHAR(64) NOT NULL,
    actual_return_date VARCHAR(64),
    parent_consent_verified INTEGER DEFAULT 0,
    parent_consent_notes TEXT,
    status VARCHAR(32) DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Rejected', 'Active', 'Completed', 'Overdue')),
    reviewed_by VARCHAR(64) REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    qr_pass_code VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS movement_records (
    id VARCHAR(64) PRIMARY KEY,
    student_id VARCHAR(64) REFERENCES students(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL CHECK(type IN ('Check-out', 'Check-in')),
    gate_name VARCHAR(128) DEFAULT 'Main Campus Gate',
    destination VARCHAR(255),
    purpose VARCHAR(255),
    status VARCHAR(32) DEFAULT 'Normal' CHECK(status IN ('Normal', 'Late', 'Overdue', 'Unauthorized', 'Flagged')),
    guard_id VARCHAR(64) REFERENCES users(id),
    leave_request_id VARCHAR(64) REFERENCES leave_requests(id),
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exception_alerts (
    id VARCHAR(64) PRIMARY KEY,
    student_id VARCHAR(64) REFERENCES students(id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL CHECK(type IN ('Curfew Missed', 'Overdue Return', 'Spoof Attempt', 'Unauthorized Exit', 'Face Mismatch')),
    severity VARCHAR(32) DEFAULT 'Medium' CHECK(severity IN ('Low', 'Medium', 'High', 'Critical')),
    description TEXT NOT NULL,
    status VARCHAR(32) DEFAULT 'Open' CHECK(status IN ('Open', 'Acknowledged', 'Resolved', 'Escalated')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(64) REFERENCES users(id),
    resolution_notes TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(64) DEFAULT 'Info',
    is_read INTEGER DEFAULT 0,
    metadata TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(128) NOT NULL,
    target_type VARCHAR(64),
    target_id VARCHAR(64),
    details TEXT,
    ip_address VARCHAR(64),
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(128) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_students_roll ON students(roll_number);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(current_status);
CREATE INDEX IF NOT EXISTS idx_students_room ON students(room_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_leave_student ON leave_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_movement_student ON movement_records(student_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_status ON exception_alerts(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

-- 3. Enable RLS and Grant Access for Service Role / App Access
ALTER TABLE hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE movement_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE exception_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Allow public access policies for application operations
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow all for authenticated/service" ON hostels;
    CREATE POLICY "Allow all for authenticated/service" ON hostels FOR ALL USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Allow all for authenticated/service" ON blocks;
    CREATE POLICY "Allow all for authenticated/service" ON blocks FOR ALL USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Allow all for authenticated/service" ON floors;
    CREATE POLICY "Allow all for authenticated/service" ON floors FOR ALL USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Allow all for authenticated/service" ON rooms;
    CREATE POLICY "Allow all for authenticated/service" ON rooms FOR ALL USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Allow all for authenticated/service" ON users;
    CREATE POLICY "Allow all for authenticated/service" ON users FOR ALL USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Allow all for authenticated/service" ON students;
    CREATE POLICY "Allow all for authenticated/service" ON students FOR ALL USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Allow all for authenticated/service" ON attendance_records;
    CREATE POLICY "Allow all for authenticated/service" ON attendance_records FOR ALL USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Allow all for authenticated/service" ON leave_requests;
    CREATE POLICY "Allow all for authenticated/service" ON leave_requests FOR ALL USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Allow all for authenticated/service" ON movement_records;
    CREATE POLICY "Allow all for authenticated/service" ON movement_records FOR ALL USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Allow all for authenticated/service" ON exception_alerts;
    CREATE POLICY "Allow all for authenticated/service" ON exception_alerts FOR ALL USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Allow all for authenticated/service" ON notifications;
    CREATE POLICY "Allow all for authenticated/service" ON notifications FOR ALL USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Allow all for authenticated/service" ON audit_logs;
    CREATE POLICY "Allow all for authenticated/service" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Allow all for authenticated/service" ON system_settings;
    CREATE POLICY "Allow all for authenticated/service" ON system_settings FOR ALL USING (true) WITH CHECK (true);
END $$;

-- 4. Seed Hostel Architecture
INSERT INTO hostels (id, name, code, address, latitude, longitude, geofence_radius_meters)
VALUES ('hostel-tagore-main', 'Tagore Central Hostel Complex', 'TAGORE-MAIN', 'G. Pulla Reddy Engineering College Campus, Kurnool, Andhra Pradesh 518007', 15.774299, 78.054718, 35)
ON CONFLICT (id) DO UPDATE SET latitude = 15.774299, longitude = 78.054718, geofence_radius_meters = 35;

INSERT INTO blocks (id, hostel_id, name, code, gender, total_floors) VALUES
('block-a', 'hostel-tagore-main', 'Block A - Annapurna', 'BLK-A', 'Female', 4),
('block-b', 'hostel-tagore-main', 'Block B - Arundhati', 'BLK-B', 'Female', 4),
('block-c', 'hostel-tagore-main', 'Block C - Anuradha', 'BLK-C', 'Female', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO floors (id, block_id, floor_number, name) VALUES
('floor-block-a-1', 'block-a', 1, 'Floor 1'),
('floor-block-b-1', 'block-b', 1, 'Floor 1'),
('floor-block-c-1', 'block-c', 1, 'Floor 1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO rooms (id, block_id, floor_id, room_number, capacity, occupied_count, status) VALUES
('room-a-101', 'block-a', 'floor-block-a-1', 'A-101', 4, 0, 'Available'),
('room-a-102', 'block-a', 'floor-block-a-1', 'A-102', 4, 0, 'Available'),
('room-b-101', 'block-b', 'floor-block-b-1', 'B-101', 4, 0, 'Available'),
('room-b-102', 'block-b', 'floor-block-b-1', 'B-102', 4, 0, 'Available'),
('room-b-103', 'block-b', 'floor-block-b-1', 'B-103', 4, 0, 'Available'),
('room-c-101', 'block-c', 'floor-block-c-1', 'C-101', 4, 0, 'Available'),
('room-c-102', 'block-c', 'floor-block-c-1', 'C-102', 4, 0, 'Available')
ON CONFLICT (id) DO NOTHING;

-- 5. Seed System Settings
INSERT INTO system_settings (key, value, description) VALUES
('hostel_name', 'Tagore Central Hostel Complex', 'Hostel Name'),
('hostel_lat', '15.774299', 'Central Latitude'),
('hostel_lng', '78.054718', 'Central Longitude'),
('geofence_radius_meters', '35', 'Allowed radius in meters'),
('attendance_curfew_time', '21:30', 'Daily Curfew Time'),
('overdue_grace_minutes', '15', 'Grace minutes before overdue'),
('face_match_threshold', '0.70', 'Minimum face similarity score'),
('liveness_check_enabled', '1', 'Enforce anti-spoofing check')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 6. Seed Warden & Admin Accounts
INSERT INTO users (id, username, email, password_hash, role, full_name, phone, status) VALUES
('usr-admin-1', 'admin', 'admin@hostel.edu', '$2a$10$wT2e9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'admin', 'Chief Hostel Administrator', '+91 98765 00001', 'Active'),
('usr-warden-1', 'warden', 'warden@hostel.edu', '$2a$10$wT2e9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'warden', 'Senior Residential Warden', '+91 98765 00002', 'Active')
ON CONFLICT (id) DO NOTHING;

-- 7. Seed All 26 Verified Residents from Screenshots
INSERT INTO users (id, username, email, password_hash, role, full_name, phone, status) VALUES
('usr-real-249xa33143', '249xa33143', '249xa33143@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'P.Niha Sai', '6281407537', 'Active'),
('usr-real-249xa32076', '249xa32076', '249xa32076@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'Molakathalla Pranitha', '9963962943', 'Active'),
('usr-real-249xa01059', '249xa01059', '249xa01059@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'Hemalatha', '7075220684', 'Active'),
('usr-real-269x101010', '269x101010', '269x101010@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'Kuruva Manisha', '7416480957', 'Active'),
('usr-real-239x1a05n5', '239x1a05n5', '239x1a05n5@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'Gunisetty Lakshmi Priya', '9347794494', 'Active'),
('usr-real-249xa05202', '249xa05202', '249xa05202@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'SHAIK SHAMEENA', '8008661748', 'Active'),
('usr-real-269x151117', '269x151117', '269x151117@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'P.Lavanya', '9032417560', 'Active'),
('usr-real-259xa04502', '259xa04502', '259xa04502@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'Vvvvvvvzsf', '7989569514', 'Active'),
('usr-real-249xa32070', '249xa32070', '249xa32070@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'M.Naga Mallika Reddy', '9441205217', 'Active'),
('usr-real-249xa04091', '249xa04091', '249xa04091@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'Molla Reena Tahasreen', '7702899784', 'Active'),
('usr-real-239xa04074', '239xa04074', '239xa04074@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'Kale Likithaa', '9392404813', 'Active'),
('usr-real-269x133113', '269x133113', '269x133113@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'P.Susmitha', '9347391917', 'Active'),
('usr-real-269x101013', '269x101013', '269x101013@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'Yerraballi firozunnisa', '9885452852', 'Active'),
('usr-real-259xa05151', '259xa05151', '259xa05151@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'K. Harshitha', '6305664948', 'Active'),
('usr-real-269x133045', '269x133045', '269x133045@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'D.Mounika', '9390772926', 'Active'),
('usr-real-269xa05507', '269xa05507', '269xa05507@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'M HARSHITHA', '7989372709', 'Active'),
('usr-real-269x133013', '269x133013', '269x133013@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'B.LAKSHMI PRASANNA', '9642932881', 'Active'),
('usr-real-239x1a0275', '239x1a0275', '239x1a0275@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'Anusha Perumalla', '9346103239', 'Active'),
('usr-real-26x133009', '26x133009', '26x133009@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'Kummetha Yogitha', '9281318502', 'Active'),
('usr-real-239x1a0227', '239x1a0227', '239x1a0227@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'Koduru Jahnavi', '9177125329', 'Active'),
('usr-real-239x1a0218', '239x1a0218', '239x1a0218@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'Devara Navyasree', '8639968384', 'Active'),
('usr-real-249xa01010', '249xa01010', '249xa01010@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'Jogi Jyothika', '6304943507', 'Active'),
('usr-real-269xa05517', '269xa05517', '269xa05517@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'Kurni Gayathri', '6302300340', 'Active'),
('usr-real-259xa33164', '259xa33164', '259xa33164@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'Mudugal Sai Rithika', '7013267358', 'Active'),
('usr-real-249xa33106', '249xa33106', '249xa33106@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'sowpan', '9876543210', 'Active'),
('usr-real-real2026', 'real2026', 'real2026@university.edu', '$2a$10$VvJz2u9kRj.hIeCq04pZf.4uUoVreJ09l8zUjJk8g9L3U0i6S6M.eQ6', 'student', 'Mohamed Resident', '9988776655', 'Active')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone;

INSERT INTO students (id, user_id, roll_number, full_name, email, phone, emergency_phone, parent_name, parent_phone, hostel_id, block_id, floor_id, room_id, room_number, department, year_of_study, current_status, has_face_enrolled) VALUES
('std-real-249xa33143', 'usr-real-249xa33143', '249XA33143', 'P.Niha Sai', '249xa33143@university.edu', '6281407537', '6281407537', 'Guardian', '6281407537', 'hostel-tagore-main', 'block-a', 'floor-block-a-1', 'room-a-102', 'A-102', 'Computer Science & Engineering', 1, 'Inside', 1),
('std-real-249xa32076', 'usr-real-249xa32076', '249XA32076', 'Molakathalla Pranitha', '249xa32076@university.edu', '9963962943', '9963962943', 'Guardian', '9963962943', 'hostel-tagore-main', 'block-b', 'floor-block-b-1', 'room-b-103', 'B-103', 'Computer Science & Engineering', 1, 'Inside', 0),
('std-real-249xa01059', 'usr-real-249xa01059', '249XA01059', 'Hemalatha', '249xa01059@university.edu', '7075220684', '7075220684', 'Guardian', '7075220684', 'hostel-tagore-main', 'block-b', 'floor-block-b-1', 'room-b-102', 'B-102', 'Civil Engineering', 1, 'Inside', 0),
('std-real-269x101010', 'usr-real-269x101010', '269X101010', 'Kuruva Manisha', '269x101010@university.edu', '7416480957', '7416480957', 'Guardian', '7416480957', 'hostel-tagore-main', 'block-c', 'floor-block-c-1', 'room-c-102', 'C-102', 'Civil Engineering', 1, 'Inside', 0),
('std-real-239x1a05n5', 'usr-real-239x1a05n5', '239X1A05N5', 'Gunisetty Lakshmi Priya', '239x1a05n5@university.edu', '9347794494', '9347794494', 'Guardian', '9347794494', 'hostel-tagore-main', 'block-b', 'floor-block-b-1', 'room-b-102', 'B-102', 'Computer Science & Engineering', 1, 'Inside', 1),
('std-real-249xa05202', 'usr-real-249xa05202', '249XA05202', 'SHAIK SHAMEENA', '249xa05202@university.edu', '8008661748', '8008661748', 'Guardian', '8008661748', 'hostel-tagore-main', 'block-b', 'floor-block-b-1', 'room-b-102', 'B-102', 'Computer Science & Engineering', 1, 'Inside', 1),
('std-real-269x151117', 'usr-real-269x151117', '269X151117', 'P.Lavanya', '269x151117@university.edu', '9032417560', '9032417560', 'Guardian', '9032417560', 'hostel-tagore-main', 'block-c', 'floor-block-c-1', 'room-c-102', 'C-102', 'Computer Science & Engineering', 1, 'Inside', 0),
('std-real-259xa04502', 'usr-real-259xa04502', '259XA04502', 'Vvvvvvvzsf', '259xa04502@university.edu', '7989569514', '7989569514', 'Guardian', '7989569514', 'hostel-tagore-main', 'block-b', 'floor-block-b-1', 'room-b-102', 'B-102', 'Electronics & Communication', 1, 'Inside', 0),
('std-real-249xa32070', 'usr-real-249xa32070', '249XA32070', 'M.Naga Mallika Reddy', '249xa32070@university.edu', '9441205217', '9441205217', 'Guardian', '9441205217', 'hostel-tagore-main', 'block-a', 'floor-block-a-1', 'room-a-102', 'A-102', 'Computer Science & Engineering', 1, 'Inside', 1),
('std-real-249xa04091', 'usr-real-249xa04091', '249XA04091', 'Molla Reena Tahasreen', '249xa04091@university.edu', '7702899784', '7702899784', 'Guardian', '7702899784', 'hostel-tagore-main', 'block-b', 'floor-block-b-1', 'room-b-101', 'B-101', 'Electronics & Communication', 1, 'Inside', 1),
('std-real-239xa04074', 'usr-real-239xa04074', '239XA04074', 'Kale Likithaa', '239xa04074@university.edu', '9392404813', '9392404813', 'Guardian', '9392404813', 'hostel-tagore-main', 'block-a', 'floor-block-a-1', 'room-a-101', 'A-101', 'Electronics & Communication', 1, 'Inside', 1),
('std-real-269x133113', 'usr-real-269x133113', '269X133113', 'P.Susmitha', '269x133113@university.edu', '9347391917', '9347391917', 'Guardian', '9347391917', 'hostel-tagore-main', 'block-c', 'floor-block-c-1', 'room-c-101', 'C-101', 'Computer Science & Engineering', 1, 'Inside', 1),
('std-real-269x101013', 'usr-real-269x101013', '269X101013', 'Yerraballi firozunnisa', '269x101013@university.edu', '9885452852', '9885452852', 'Guardian', '9885452852', 'hostel-tagore-main', 'block-c', 'floor-block-c-1', 'room-c-101', 'C-101', 'Civil Engineering', 1, 'Inside', 0),
('std-real-259xa05151', 'usr-real-259xa05151', '259XA05151', 'K. Harshitha', '259xa05151@university.edu', '6305664948', '6305664948', 'Guardian', '6305664948', 'hostel-tagore-main', 'block-b', 'floor-block-b-1', 'room-b-101', 'B-101', 'Computer Science & Engineering', 1, 'Inside', 1),
('std-real-269x133045', 'usr-real-269x133045', '269X133045', 'D.Mounika', '269x133045@university.edu', '9390772926', '9390772926', 'Guardian', '9390772926', 'hostel-tagore-main', 'block-c', 'floor-block-c-1', 'room-c-101', 'C-101', 'Computer Science & Engineering', 1, 'Inside', 0),
('std-real-269xa05507', 'usr-real-269xa05507', '269XA05507', 'M HARSHITHA', '269xa05507@university.edu', '7989372709', '7989372709', 'Guardian', '7989372709', 'hostel-tagore-main', 'block-a', 'floor-block-a-1', 'room-a-101', 'A-101', 'Computer Science & Engineering', 1, 'Inside', 1),
('std-real-269x133013', 'usr-real-269x133013', '269X133013', 'B.LAKSHMI PRASANNA', '269x133013@university.edu', '9642932881', '9642932881', 'Guardian', '9642932881', 'hostel-tagore-main', 'block-c', 'floor-block-c-1', 'room-c-101', 'C-101', 'Computer Science & Engineering', 1, 'Inside', 0),
('std-real-239x1a0275', 'usr-real-239x1a0275', '239X1A0275', 'Anusha Perumalla', '239x1a0275@university.edu', '9346103239', '9346103239', 'Guardian', '9346103239', 'hostel-tagore-main', 'block-b', 'floor-block-b-1', 'room-b-101', 'B-101', 'Computer Science & Engineering', 1, 'Inside', 0),
('std-real-26x133009', 'usr-real-26x133009', '26X133009', 'Kummetha Yogitha', '26x133009@university.edu', '9281318502', '9281318502', 'Guardian', '9281318502', 'hostel-tagore-main', 'block-a', 'floor-block-a-1', 'room-a-101', 'A-101', 'Computer Science & Engineering', 1, 'Inside', 1),
('std-real-239x1a0227', 'usr-real-239x1a0227', '239X1A0227', 'Koduru Jahnavi', '239x1a0227@university.edu', '9177125329', '9177125329', 'Guardian', '9177125329', 'hostel-tagore-main', 'block-b', 'floor-block-b-1', 'room-b-101', 'B-101', 'Computer Science & Engineering', 1, 'Inside', 1),
('std-real-239x1a0218', 'usr-real-239x1a0218', '239X1A0218', 'Devara Navyasree', '239x1a0218@university.edu', '8639968384', '8639968384', 'Guardian', '8639968384', 'hostel-tagore-main', 'block-b', 'floor-block-b-1', 'room-b-101', 'B-101', 'Computer Science & Engineering', 1, 'Inside', 1),
('std-real-249xa01010', 'usr-real-249xa01010', '249XA01010', 'Jogi Jyothika', '249xa01010@university.edu', '6304943507', '6304943507', 'Guardian', '6304943507', 'hostel-tagore-main', 'block-a', 'floor-block-a-1', 'room-a-101', 'A-101', 'Civil Engineering', 1, 'Inside', 1),
('std-real-269xa05517', 'usr-real-269xa05517', '269XA05517', 'Kurni Gayathri', '269xa05517@university.edu', '6302300340', '6302300340', 'Guardian', '6302300340', 'hostel-tagore-main', 'block-a', 'floor-block-a-1', 'room-a-101', 'A-101', 'Computer Science & Engineering', 1, 'Inside', 0),
('std-real-259xa33164', 'usr-real-259xa33164', '259XA33164', 'Mudugal Sai Rithika', '259xa33164@university.edu', '7013267358', '7013267358', 'Guardian', '7013267358', 'hostel-tagore-main', 'block-a', 'floor-block-a-1', 'room-a-101', 'A-101', 'Computer Science & Engineering', 1, 'Inside', 0),
('std-real-249xa33106', 'usr-real-249xa33106', '249XA33106', 'sowpan', '249xa33106@university.edu', '9876543210', '9876543210', 'Guardian', '9876543210', 'hostel-tagore-main', 'block-a', 'floor-block-a-1', 'room-a-101', 'A-101', 'Computer Science & Engineering', 1, 'Inside', 1),
('std-real-real2026', 'usr-real-real2026', 'REAL2026', 'Mohamed Resident', 'real2026@university.edu', '9988776655', '9988776655', 'Guardian', '9988776655', 'hostel-tagore-main', 'block-a', 'floor-block-a-1', 'room-a-101', 'A-101', 'Computer Science & Engineering', 1, 'Inside', 1)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  phone = EXCLUDED.phone,
  department = EXCLUDED.department,
  room_id = EXCLUDED.room_id,
  room_number = EXCLUDED.room_number,
  has_face_enrolled = EXCLUDED.has_face_enrolled;
