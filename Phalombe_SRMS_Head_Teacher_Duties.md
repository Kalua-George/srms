# PHALOMBE SECONDARY SCHOOL

## School Record Management System (SRMS)

# HEAD TEACHER DUTIES & RESPONSIBILITIES

------------------------------------------------------------------------

## 🎯 Core Idea

The Head Teacher is the **overall academic controller of the entire
school system**.

Unlike HOD (department-level), the Head Teacher operates at a
**school-wide level**.

------------------------------------------------------------------------

## 1️⃣ System-Wide Oversight

The Head Teacher can:

-   View **all teachers** across all departments
-   View **all departments**
-   View **all classes and subjects**
-   Monitor entire school academic activity

------------------------------------------------------------------------

## 2️⃣ Teacher Management

The Head Teacher can:

-   Create new teachers
-   Update teacher details
-   Delete/remove teachers
-   Assign teachers to:
    -   Departments
    -   Classes
    -   Subjects

------------------------------------------------------------------------

## 3️⃣ Class & Subject Management

The Head Teacher can:

-   Create classes
-   View all classes
-   Assign subjects to classes
-   Assign teachers to classes

------------------------------------------------------------------------

## 4️⃣ Exam Management (Highest Authority)

The Head Teacher can:

-   Create exams for the **entire school**
-   View all exams across all departments
-   Oversee exam performance

### Role Comparison:

  Role           Exam Power
  -------------- ---------------------------------
  Teacher        Assigned subjects only
  HOD            Department-level end-term exams
  Head Teacher   Entire school

------------------------------------------------------------------------

## 5️⃣ Academic Performance Monitoring

The Head Teacher can:

-   View school-wide:
    -   Pass rates
    -   Fail rates
    -   Grade distributions
-   Compare:
    -   Departments
    -   Classes
    -   Subjects
-   Identify weak performance areas

------------------------------------------------------------------------

## 6️⃣ Discipline Oversight

The Head Teacher can:

-   View all discipline records
-   Monitor student behavior across the school
-   Identify behavioral trends

------------------------------------------------------------------------

## 7️⃣ Reports & Analytics

The Head Teacher dashboard should include:

-   Total Students
-   Total Teachers
-   Total Classes
-   Total Departments
-   Exam performance summaries
-   Attendance summaries
-   Discipline summaries

------------------------------------------------------------------------

## 8️⃣ System Control (Non-Technical)

The Head Teacher:

### Can:

-   Control academic operations
-   Manage school structure

### Cannot:

-   Modify database directly
-   Change system configurations/code

------------------------------------------------------------------------

## 🧠 Role Hierarchy

Teacher → Own classes only\
HOD → Teacher + Department control\
Head Teacher → Full school control

------------------------------------------------------------------------

## 🖥️ Suggested Dashboard Structure

### Sidebar:

-   Dashboard
-   Teachers
-   Classes
-   Subjects
-   Exams
-   Departments
-   Reports
-   Discipline

### Main Dashboard Sections:

-   Welcome section
-   Summary cards (Teachers, Students, Classes, Departments)
-   Quick actions (Add Teacher, Create Class, Assign Teacher, Create
    Exam)
-   Performance overview
-   Recent activity

------------------------------------------------------------------------

## 🔐 Backend Logic

All Head Teacher routes must enforce:

``` php
if ($_SESSION['user']['role'] !== 'head_teacher') {
    deny();
}
```

Head Teacher has **no department restriction** and can access the entire
system.

------------------------------------------------------------------------

## 📌 Final Definition

The Head Teacher is the highest academic authority in the SRMS,
responsible for overseeing all school operations including teacher
management, class organization, examination control, and performance
monitoring across all departments.
