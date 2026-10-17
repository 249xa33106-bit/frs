export type UserRole = 'student' | 'warden' | 'admin';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  last_login?: string;
}

export interface Student {
  id: string;
  user_id: string;
  roll_number: string;
  full_name: string;
  email: string;
  phone: string;
  emergency_phone: string;
  parent_name: string;
  parent_phone: string;
  hostel_id: string;
  hostel_name?: string;
  block_id: string;
  block_name?: string;
  floor_id: string;
  floor_name?: string;
  room_id: string;
  room_number: string;
  department: string;
  year_of_study: number;
  current_status: 'Inside' | 'Outside' | 'On Leave' | 'Unknown';
  has_face_enrolled: number;
  face_descriptor?: string;
  attendance_exempt: number;
  today_attendance?: 'Present' | 'Absent' | 'Verification Failed' | 'Excused';
  hostel_lat?: number;
  hostel_lng?: number;
  geofence_radius_meters?: number;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  full_name?: string;
  roll_number?: string;
  room_number?: string;
  date: string;
  session_name: string;
  status: 'Present' | 'Absent' | 'Verification Failed' | 'Excused' | 'Late';
  verification_method: string;
  confidence_score?: number;
  liveness_verified: number;
  location_verified: number;
  latitude?: number;
  longitude?: number;
  distance_from_hostel_meters?: number;
  failure_reason?: string;
  timestamp: string;
}

export interface LeaveRequest {
  id: string;
  student_id: string;
  full_name?: string;
  roll_number?: string;
  room_number?: string;
  phone?: string;
  emergency_phone?: string;
  parent_name?: string;
  block_name?: string;
  reviewer_name?: string;
  leave_type: 'Outing' | 'Night Out' | 'Home Leave' | 'Emergency/Medical' | 'Academic Visit';
  reason: string;
  destination: string;
  departure_date: string;
  expected_return_date: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | 'Expired';
  parent_informed: number;
  parent_consent_phone?: string;
  warden_remarks?: string;
  reviewed_by_user_id?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface MovementRecord {
  id: string;
  student_id: string;
  full_name?: string;
  roll_number?: string;
  room_number?: string;
  phone?: string;
  emergency_phone?: string;
  parent_phone?: string;
  block_name?: string;
  destination?: string;
  reason?: string;
  leave_request_id?: string;
  leave_type?: string;
  movement_type: string;
  status: 'Outside' | 'Returned' | 'Overdue';
  actual_departure_time: string;
  expected_return_time: string;
  actual_return_time?: string;
  departure_gate: string;
  return_gate?: string;
  is_overdue: number;
  overdue_minutes: number;
  created_at: string;
}

export interface ExceptionAlert {
  id: string;
  student_id: string;
  full_name?: string;
  roll_number?: string;
  room_number?: string;
  phone?: string;
  emergency_phone?: string;
  parent_name?: string;
  parent_phone?: string;
  block_name?: string;
  type: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Open' | 'Acknowledged' | 'Resolved' | 'Dismissed';
  title: string;
  description: string;
  resolution_notes?: string;
  resolved_by_name?: string;
  created_at: string;
  resolved_at?: string;
}

export interface NotificationItem {
  id: string;
  user_id?: string;
  student_id?: string;
  title: string;
  message: string;
  type: string;
  is_read: number;
  created_at: string;
}

export interface WardenStats {
  kpis: {
    totalStudents: number;
    insideHostel: number;
    onLeave: number;
    currentlyOutside: number;
    attentionRequired: number;
  };
  attendanceOverview: {
    present: number;
    notGiven: number;
    verificationFailed: number;
    excused: number;
    totalStudents: number;
  };
  attentionQueue: ExceptionAlert[];
  pendingLeaves: LeaveRequest[];
  recentMovements: MovementRecord[];
  overdueAlerts: MovementRecord[];
  attendanceTrend: {
    date: string;
    day: string;
    present: number;
    absent: number;
    failed: number;
  }[];
}

export interface Room {
  id: string;
  floor_id: string;
  block_id: string;
  room_number: string;
  capacity: number;
  occupied_count: number;
  status: string;
  student_count?: number;
  inside_count?: number;
  outside_count?: number;
  leave_count?: number;
}

export interface Block {
  id: string;
  hostel_id: string;
  name: string;
  code: string;
  gender: string;
  total_floors: number;
}

export interface Floor {
  id: string;
  block_id: string;
  floor_number: number;
  name: string;
}
