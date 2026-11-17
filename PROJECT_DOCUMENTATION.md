# SRMS - Full Project Documentation

## 1. Project Overview

SRMS (School Records Management System) is a role-based school management web application built with:

- PHP (custom MVC-like structure)
- MySQL/MariaDB (via PDO)
- Vanilla HTML/CSS/JavaScript frontend
- Session-based authentication

It supports three core roles:

- Teacher
- HOD (Head of Department)
- Head Teacher

The system manages:

- Authentication and session context (academic year and term)
- Students and teachers
- Department management
- Class and subject assignments
- Attendance
- Exams and grade entry
- Discipline records
- Assignment request approvals (HOD -> Head Teacher flow)

## 2. High-Level Architecture

### 2.1 Request Flow

1. Browser requests endpoint under `/srms/public`
2. `public/index.php` starts the session and normalizes the request path
3. Request is dispatched through `routes/routes.php`
4. Matching controller method executes business logic
5. Controller returns JSON response
6. Frontend JavaScript updates role dashboard UI

### 2.2 Application Layers

- Entry layer: `public/index.php`
- Routing layer: `routes/routes.php`
- Controller layer: `app/controllers/*`
- Model/data layer: `app/models/*`
- DB config: `app/config/database.php`
- UI layer: `public/*.html`, `public/assets/css/*`, `public/assets/js/*`
- SQL bootstrap: `public/school_data.sql`

## 3. Directory Structure

```text
srms/
├── app/
│   ├── config/
│   │   └── database.php
│   ├── controllers/
│   │   ├── AttendanceController.php
│   │   ├── AuthController.php
│   │   ├── BaseController.php
│   │   ├── DepartmentController.php
│   │   ├── DisciplinaryController.php
│   │   ├── ExamController.php
│   │   ├── HODController.php
│   │   ├── HeadTeacherController.php
│   │   ├── StudentController.php
│   │   ├── TeacherController.php
│   │   └── departmentcontroller.php (duplicate/legacy naming)
│   ├── helpers/
│   └── models/
│       ├── Attendance.php
│       ├── BaseModel.php
│       ├── Discipline.php
│       ├── Exam.php
│       ├── Grade.php
│       ├── Student.php
│       └── Teacher.php
├── public/
│   ├── index.php
│   ├── login.html
│   ├── school_data.sql
│   ├── head/dashboard.html
│   ├── hod/dashboard.html
│   ├── teacher/dashboard.html
│   ├── assets/
│   │   ├── css/
│   │   ├── js/
│   │   │   ├── api.js
│   │   │   ├── basedashboard.js
│   │   │   ├── login.js
│   │   │   ├── headTeacher/headteacher.js
│   │   │   ├── hod/hod.js
│   │   │   └── teacher/teacher.js
│   │   └── media/images/
│   └── tests/
├── routes/
│   └── routes.php
└── Phalombe_SRMS_Head_Teacher_Duties.md
```

## 4. Runtime and Environment

### 4.1 Required Stack

- Apache (XAMPP/LAMPP)
- PHP 8+ (code uses `declare(strict_types=1)` and `str_starts_with`)
- MySQL/MariaDB

### 4.2 Base URL

The router expects the app under:

```
/srms/public
```

Typical local URL:

```
http://localhost/srms/public
```

### 4.3 Database Connection

Configured in `app/config/database.php`:

- Host: `localhost`
- Database: `school_data`
- Username: `root`
- Password: empty string
- Charset: `utf8mb4`

## 5. Setup and Run Guide

1. Place project in Apache web root (`htdocs`)
2. Start Apache and MySQL in XAMPP/LAMPP
3. Create/import database using `public/school_data.sql`
4. Verify DB credentials in `app/config/database.php`
5. Open `http://localhost/srms/public`
6. Login with a valid `teacher_code` from `teachers` table

## 6. Authentication and Session Model

### 6.1 Login

Endpoint: `POST /app/auth/login`

Request body expects:

- `teacher_code`

On success, session data is created:

- `$_SESSION['user']`: id, role, name, department_id
- `$_SESSION['context']`: academic_year_id, term_id

### 6.2 Session APIs

- `GET /app/auth/me`: current authenticated user and context
- `POST /app/auth/logout`: destroys session
- `POST /app/auth/set-context`: updates year/term context

### 6.3 Role Authorization

`BaseController` provides:

- `requireAuth()`
- `requireRole([...])`

Main roles in active code:

- `teacher`
- `hod`
- `head_teacher`

## 7. API Route Reference

All routes are defined in `routes/routes.php`.

### 7.1 GET Routes

- `/app/auth/me`
- `/app/students`
- `/app/students/show`
- `/app/students/attendance`
- `/app/students/grades`
- `/app/hod/dashboard`
- `/app/hod/teachers`
- `/app/hod/teacher-classes`
- `/app/hod/teacher-subjects`
- `/app/hod/assignment-requests`
- `/app/head/dashboard`
- `/app/head/teachers`
- `/app/head/forms`
- `/app/head/classes`
- `/app/head/subjects`
- `/app/head/exams`
- `/app/head/exams/subjects`
- `/app/head/assignment-requests`
- `/app/exams`
- `/app/exams/show`
- `/app/exams/subjects`
- `/app/exams/grades`
- `/app/discipline/types`
- `/app/discipline/actions`
- `/app/discipline/student`
- `/app/discipline/list`
- `/app/departments`
- `/app/departments/show`
- `/app/departments/teachers`
- `/app/attendance/class`
- `/app/attendance/student`
- `/app/attendance/summary`

### 7.2 POST Routes

- `/app/auth/login`
- `/app/auth/logout`
- `/app/auth/set-context`
- `/app/students/create`
- `/app/students/update`
- `/app/students/delete`
- `/app/hod/assign-class`
- `/app/hod/assign-subject`
- `/app/head/teachers/create`
- `/app/head/teachers/update`
- `/app/head/teachers/delete`
- `/app/head/assign-class`
- `/app/head/assign-subject`
- `/app/head/assignment-requests/approve`
- `/app/head/assignment-requests/reject`
- `/app/head/classes/create`
- `/app/head/exams/create`
- `/app/exams/create`
- `/app/exams/delete`
- `/app/exams/enter-grade`
- `/app/discipline/create`
- `/app/discipline/update`
- `/app/discipline/delete`
- `/app/departments/create`
- `/app/departments/update`
- `/app/departments/delete`
- `/app/departments/set-hod`
- `/app/attendance/mark`

## 8. Controller Responsibilities

- `BaseController.php`: JSON responses, request parsing, auth/role checks, helper accessors
- `AuthController.php`: login/logout/session context APIs
- `StudentController.php`: list/show/create/update/delete plus student attendance/grades views
- `TeacherController.php`: role-aware teacher listing/detail and CRUD
- `HODController.php`: departmental dashboard and assignment request creation
- `HeadTeacherController.php`: school-wide dashboard, teacher management, class/subject/exam management, assignment approvals
- `ExamController.php`: exam CRUD and grade entry
- `DisciplinaryController.php`: discipline types/actions/records CRUD and queries
- `DepartmentController.php`: department CRUD and HOD assignment
- `AttendanceController.php`: attendance marking and summaries

## 9. Model Responsibilities

- `BaseModel.php`: PDO connection usage, audit-style logging helpers, context metadata
- `Student.php`: student CRUD and related operations
- `Teacher.php`: teacher CRUD and assignment operations
- `Attendance.php`: attendance persistence/query logic
- `Exam.php`: exam lifecycle and exam-subject logic
- `Grade.php`: grade entry and retrieval logic
- `Discipline.php`: disciplinary record management

## 10. Frontend UI and Scripts

### 10.1 Shared Frontend Modules

- `public/assets/js/api.js`: centralized fetch wrapper with JSON/text handling
- `public/assets/js/basedashboard.js`: shared dashboard bootstrap (auth check, logout wiring, user display)
- `public/assets/js/login.js`: login form submission and role-based redirect

### 10.2 Role Dashboards

- Teacher UI: `public/teacher/dashboard.html` + `public/assets/js/teacher/teacher.js`
- HOD UI: `public/hod/dashboard.html` + `public/assets/js/hod/hod.js`
- Head Teacher UI: `public/head/dashboard.html` + `public/assets/js/headTeacher/headteacher.js`

Current dashboard scripts focus on:

- Initial auth bootstrap
- User identity rendering
- Panel/tab switching within each role portal

## 11. Database Schema Inventory

Primary tables defined in `public/school_data.sql`:

- `academic_years`
- `attendance`
- `classes`
- `departments`
- `disciplinary_actions`
- `disciplinary_records`
- `disciplinary_types`
- `exams`
- `exam_subjects`
- `forms`
- `grades`
- `grade_table`
- `logs`
- `students`
- `subjects`
- `teachers`
- `teacher_classes`
- `teacher_subjects`
- `teacher_assignment_requests`
- `terms`

### 11.1 Core Relationship Summary

- Teachers belong to departments (`teachers.department_id`)
- Departments can have one HOD (`departments.hod_id`)
- Students belong to classes/forms
- Teacher-class and teacher-subject are many-to-many via join tables
- Exams relate to subjects through `exam_subjects`
- Grades connect students to exam subjects
- Attendance is tracked by date/class/student
- Assignment workflow is captured in `teacher_assignment_requests`

## 12. Logging and Auditing

`BaseModel::logAction()` writes to `logs` table with:

- `user_id`
- action name
- optional description
- `academic_year_id`
- `term_id`

This supports traceability of create/update/delete operations in models.

## 13. Known Issues and Codebase Notes

- Duplicate controller filename exists: `app/controllers/DepartmentController.php` and `app/controllers/departmentcontroller.php`.
- `public/login.html` includes a password field, but backend login currently authenticates using only `teacher_code`.
- `public/assets/js/login.js` contains redirect logic for `admin`, but no admin dashboard/controller is visible in current structure.
- Some UI text in dashboards appears placeholder/demo style and may not fully match live API data wiring.

## 14. Testing and Validation

Current repository includes:

- `public/tests/test.js`
- `public/tests/test2.html`

No automated CI test suite configuration (e.g., PHPUnit/Jest config) is currently visible in root structure.

## 15. Suggested Next Improvements

- Add a root `README.md` and link this document from it
- Add password-based authentication and secure hashing
- Consolidate duplicate controller files and naming
- Add centralized error handling and API validation schema
- Add migration/seeder strategy for repeatable database setup
- Add automated tests for controllers and model operations
- Add environment-based config (`.env`) instead of hardcoded DB credentials

## 16. Quick Reference

- App entry: `public/index.php`
- Router: `routes/routes.php`
- DB config: `app/config/database.php`
- SQL dump: `public/school_data.sql`
- Login page: `public/login.html`
- Role dashboards: `public/head/dashboard.html`, `public/hod/dashboard.html`, `public/teacher/dashboard.html`

---

documented on the 2nd of april 2026

