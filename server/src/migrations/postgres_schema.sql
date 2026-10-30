-- ======================================================================
-- Hostel Safety Management System - PostgreSQL Production Schema
-- Designed for enterprise hostel deployment (1,200+ residents)
-- ======================================================================

-- Hostels
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

-- Blocks
CREATE TABLE IF NOT EXISTS blocks (
    id VARCHAR(64) PRIMARY KEY,
    hostel_id VARCHAR(64) REFERENCES hostels(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64) NOT NULL,
    gender VARCHAR(32) DEFAULT 'Co-ed',
    total_floors INTEGER DEFAULT 4,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Floors
CREATE TABLE IF NOT EXISTS floors (
    id VARCHAR(64) PRIMARY KEY,
    block_id VARCHAR(64) REFERENCES blocks(id) ON DELETE CASCADE,
    floor_number INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Rooms
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

-- Users
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

-- Students
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
    attendance_exempt INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Attendance Records
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

-- Leave Requests
CREATE TABLE IF NOT EXISTS leave_requests (
    id VARCHAR(64) PRIMARY KEY,
    student_id VARCHAR(64) REFERENCES students(id) ON DELETE CASCADE,
    leave_type VARCHAR(64) NOT NULL CHECK(leave_type IN ('Outing', 'Night Out', 'Home Leave', 'Emergency/Medical', 'Academic Visit')),
    reason TEXT NOT NULL,
    destination VARCHAR(255) NOT NULL,
    departure_date VARCHAR(64) NOT NULL,
    expected_return_date VARCHAR(64) NOT NULL,
    status VARCHAR(32) DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Rejected', 'Cancelled', 'Expired')),
    parent_informed INTEGER DEFAULT 1,
    parent_consent_phone VARCHAR(64),
    warden_remarks TEXT,
    reviewed_by_user_id VARCHAR(64) REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Movement Records
CREATE TABLE IF NOT EXISTS movement_records (
    id VARCHAR(64) PRIMARY KEY,
    student_id VARCHAR(64) REFERENCES students(id) ON DELETE CASCADE,
    leave_request_id VARCHAR(64) REFERENCES leave_requests(id) ON DELETE SET NULL,
    movement_type VARCHAR(64) NOT NULL,
    status VARCHAR(32) DEFAULT 'Outside' CHECK(status IN ('Outside', 'Returned', 'Overdue')),
    actual_departure_time VARCHAR(64) NOT NULL,
    expected_return_time VARCHAR(64) NOT NULL,
    actual_return_time VARCHAR(64),
    departure_gate VARCHAR(128) DEFAULT 'Main Campus Gate A',
    return_gate VARCHAR(128),
    return_verification_method VARCHAR(128),
    return_location_lat NUMERIC(10, 6),
    return_location_lng NUMERIC(10, 6),
    return_notes TEXT,
    is_overdue INTEGER DEFAULT 0,
    overdue_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Exception Alerts
CREATE TABLE IF NOT EXISTS exception_alerts (
    id VARCHAR(64) PRIMARY KEY,
    student_id VARCHAR(64) REFERENCES students(id) ON DELETE CASCADE,
    type VARCHAR(64) NOT NULL,
    severity VARCHAR(32) NOT NULL CHECK(severity IN ('Critical', 'High', 'Medium', 'Low')),
    status VARCHAR(32) DEFAULT 'Open' CHECK(status IN ('Open', 'Acknowledged', 'Resolved', 'Dismissed')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    resolution_notes TEXT,
    resolved_by_user_id VARCHAR(64) REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    student_id VARCHAR(64) REFERENCES students(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(64) NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(128) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id VARCHAR(64),
    details TEXT,
    ip_address VARCHAR(64),
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- System Settings
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(64) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_pg_students_roll ON students(roll_number);
CREATE INDEX IF NOT EXISTS idx_pg_students_status ON students(current_status);
CREATE INDEX IF NOT EXISTS idx_pg_students_room ON students(room_id);
CREATE INDEX IF NOT EXISTS idx_pg_attendance_date ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_pg_attendance_student ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_pg_leave_student ON leave_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_pg_leave_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_pg_movement_student ON movement_records(student_id);
CREATE INDEX IF NOT EXISTS idx_pg_movement_status ON movement_records(status);
CREATE INDEX IF NOT EXISTS idx_pg_exceptions_status ON exception_alerts(status);
CREATE INDEX IF NOT EXISTS idx_pg_exceptions_student ON exception_alerts(student_id);
CREATE INDEX IF NOT EXISTS idx_pg_notifications_user ON notifications(user_id);
