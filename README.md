# Hostel Safety — Hostel Attendance & Student Movement Management System

A modern, responsive, enterprise fullstack web platform designed to manage **1,200 hostel students** across a multi-wing complex (Tagore Central Hostel Complex: Nalanda, Takshashila, and Aryabhata Blocks).

The system integrates **Live Face Recognition (FRS)**, **Anti-Spoofing Liveness Checks**, **GPS Geofence Verification**, **Leave Approval Workflows**, **Gate Movement Tracking**, **Automated Return-Overdue Detection**, and **Warden Safety Monitoring**.

---

## 🎨 Mandatory Design Direction: Light Mode Only

The entire application adheres strictly to an enterprise SaaS light aesthetic:
- **Page Background:** `#F6F8FC`
- **Main Card Background:** `#FFFFFF`
- **Primary Action Blue:** `#2563EB`
- **Secondary Blue:** `#3B82F6`
- **Heading Text:** `#172033`
- **Body Text:** `#64748B`
- **Border Lines:** `#E2E8F0`
- **Success Indicators:** `#16A34A`
- **Warning Badges:** `#D97706`
- **Critical / Overdue Alerts:** `#DC2626`
- **Supporting Accent:** `#7C3AED`

*Note: No dark mode or dark themes are implemented; light appearance persists across all portals and dialogs.*

---

## 🏗️ Architecture Overview

The platform provides three tailored experiences based on user roles:

1. **Student Portal (Mobile-First):**
   - **Give Attendance (FRS):** Live camera view with facial alignment oval, liveness verification, campus GPS geofencing distance check, and duplicate submission prevention.
   - **Outgoing / Leave Applications:** Apply for Day Outing, Night Out, Home Leave, or Emergency/Medical visits with automated parent notification and warden routing.
   - **"I Have Returned" Action:** Dynamic return button active while outside, updating status to *Inside* and resolving open overdue exceptions upon arrival.
   - **My Leave & Movement History:** Tabbed timeline of attendance and physical gate check-in/outs.
   - **Safety Notifications:** Official curfew reminders and leave approval decisions.

2. **Warden Portal (Operational Dashboard):**
   - **Live Operational KPIs:** Total Students (1,200), Currently Inside, On Approved Leave, Currently Outside, and Attention Required.
   - **Attendance Overview:** Today's verified roll call vs unsubmitted curfew counts.
   - **7-Day Attendance Trend:** Recharts visualization of attendance compliance.
   - **Leave Approval Queue:** Multi-filter queue (Pending, Approved, Rejected) with confirmation dialogs and remarks.
   - **Movement Management:** Real-time tracking of students outside and manual security gate check-in action.
   - **Automated Exception Detection Queue:** Overdue returns, curfew non-compliance, and biometric verification anomalies.
   - **Live Hostel Presence:** Block-by-block and room-by-room presence breakdown.

3. **Administrator Portal:**
   - **Hostel & Room Configuration:** Management of 3 blocks, 12 floors, and 300 rooms (1,200 student capacity).
   - **Student Management:** Resident registration and 128-d biometric facial template enrollment.
   - **Staff & User Roles:** Provisioning of warden and administrative accounts.
   - **System Parameters:** Configurable campus GPS coordinates, geofence radius (250m), curfew time (21:30), grace period, and facial match sensitivity.
   - **Security Audit Logs:** Immutable ledger of administrative and gate operations.

4. **Biometric Face Recognition Microservice:**
   - Python FastAPI + OpenCV (`cv2`) Haar Cascade Face Detector + Eye Liveness Detector on port `8005`.
   - Real-time telemetry connection with transparent status reporting.

---

## ⚡ Quick Start & Running the Application

### 1. Prerequisites
- **Node.js** (v18+ or v20+ or v24+)
- **Python** (v3.9+ with `opencv-python`, `fastapi`, `uvicorn`, `numpy`)

### 2. Start All Services in One Command
From the project root directory:
```bash
npm run dev
```
This concurrently starts:
- **Backend API Server** at [http://localhost:5000](http://localhost:5000)
- **Frontend Client** at [http://localhost:3000](http://localhost:3000)
- **Python OpenCV Face Service** at [http://localhost:8005](http://localhost:8005)

*Alternatively, you can access the unified production build directly at [http://localhost:5000](http://localhost:5000).*

### 3. Database Re-seeding (Optional)
To re-seed the SQLite database with the full 1,200 students dataset and realistic historical movements:
```bash
npm run seed
```

---

## 🗄️ Real Database Connection (PostgreSQL)

The system supports connecting directly to any enterprise or cloud PostgreSQL database (e.g., **Supabase**, **Neon**, **AWS RDS**, **DigitalOcean**, **Railway**, **Render**, or **Docker**):

### 1. Configure Connection in `server/.env`
Open [`server/.env`](file:///c:/Users/moham/OneDrive/Documents/Desktop/PROJECT%20GH/server/.env) and set your `DATABASE_URL`:
```env
DATABASE_URL="postgresql://username:password@hostname:5432/database_name?sslmode=require"
DATABASE_TYPE=postgres
```

### 2. Run Instant Migration & Population
Transfer all 1,200 students, 300 rooms, attendance history, and movements directly to your PostgreSQL database:
```bash
cd server
npx tsx src/scripts/migrate-to-postgres.ts
```

### 3. Local PostgreSQL via Docker (Optional)
If you have Docker installed, start a local PostgreSQL container in 5 seconds:
```bash
docker compose up -d
```
Connection string: `postgresql://postgres:postgrespassword@localhost:5432/hostel_safety`


---

## 👥 Default Personas & Evaluator Demo Accounts

All accounts share default password: `student123` (for students) and `warden123` / `admin123` (for staff). A **"Demo Role"** switcher is also conveniently embedded in the top navigation bar for one-click evaluation without re-typing credentials.

| Persona | Role | Username | Password | Context |
| :--- | :--- | :--- | :--- | :--- |
| **Priya Sharma** | Student | `student` | `student123` | Room A-204 (Standard resident inside hostel) |
| **Rahul Mehta** | Student | `student_out` | `student123` | Room A-204 (On approved medical outing to AIIMS) |
| **Rohan Gupta** | Student | `student_overdue` | `student123` | Room A-205 (2h overdue outside; triggers safety alert) |
| **Dr. Rajesh Verma** | Chief Warden | `warden` | `warden123` | Full operational oversight, approvals, and exception queue |
| **Prof. Sunita Rao** | Block Warden | `warden_nalanda`| `warden123` | Nalanda Block A operational management |
| **Col. S. Deshmukh** | Administrator| `admin` | `admin123` | System settings, geofencing, room config & user roles |

---

## 📊 Database Schema Summary

The SQLite database (`server/data/hostel_safety.db`) follows a normalized structure:
- `hostels`: Campus center coordinates (`latitude`, `longitude`, `geofence_radius_meters`).
- `blocks`: Blocks A (Nalanda), B (Takshashila), C (Aryabhata).
- `floors`: Ground, 1st, 2nd, and 3rd floors per block.
- `rooms`: 300 rooms with 4-bed capacity (1,200 beds total).
- `users`: User profiles with bcrypt-hashed passwords and role constraints (`student`, `warden`, `admin`).
- `students`: Roll number, room mapping, parent contact info, current status (`Inside`, `Outside`, `On Leave`), and biometric descriptors.
- `attendance_records`: FRS confidence score, liveness status, distance from hostel, timestamp.
- `leave_requests`: Outing/leave applications with departure, expected return, and warden review logs.
- `movement_records`: Physical gate checkout/checkins, overdue minutes calculation.
- `exception_alerts`: Automated safety exceptions (`OVERDUE_RETURN`, `ATTENDANCE_NOT_SUBMITTED`, `VERIFICATION_FAILED`).
- `notifications`: Student curfew and approval alerts.
- `audit_logs`: Administrative actions with IP address and timestamp.
- `system_settings`: Key-value configuration for curfew, grace period, and geofencing.

---

## 🛠️ Security & Privacy Measures

1. **Biometric Privacy:** Facial data is stored strictly as normalized numeric landmark vectors (`face_descriptor`), avoiding raw image storage in the persistent database.
2. **GPS Geofencing:** Client coordinates are compared on the server against configured campus latitude/longitude using the Haversine formula (250m radius).
3. **Role Authorization:** Protected endpoints enforce JWT token validation and role-based access control (`student`, `warden`, `admin`).
4. **Anti-Duplication:** Students cannot mark duplicate attendance for the same curfew session or submit duplicate return confirmations.
