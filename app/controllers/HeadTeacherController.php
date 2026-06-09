<?php
require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/Teacher.php';
require_once __DIR__ . '/../models/Exam.php';

class HeadTeacherController extends BaseController
{
    private function ensureAssignmentRequestSchema(): void
    {
        try {
            $pdo = $this->pdo();

            $hasClassId = $pdo->query("SHOW COLUMNS FROM teacher_assignment_requests LIKE 'class_id'")->fetch(PDO::FETCH_ASSOC);
            if (!$hasClassId) {
                $pdo->exec("ALTER TABLE teacher_assignment_requests ADD COLUMN class_id INT(11) NULL AFTER target_id");
            }

            $hasSubjectId = $pdo->query("SHOW COLUMNS FROM teacher_assignment_requests LIKE 'subject_id'")->fetch(PDO::FETCH_ASSOC);
            if (!$hasSubjectId) {
                $pdo->exec("ALTER TABLE teacher_assignment_requests ADD COLUMN subject_id INT(11) NULL AFTER class_id");
            }

            $assignmentTypeCol = $pdo->query("SHOW COLUMNS FROM teacher_assignment_requests LIKE 'assignment_type'")->fetch(PDO::FETCH_ASSOC);
            $currentType = strtolower((string)($assignmentTypeCol['Type'] ?? ''));
            if ($currentType !== '' && strpos($currentType, "'both'") === false) {
                $pdo->exec("ALTER TABLE teacher_assignment_requests MODIFY assignment_type ENUM('class','subject','both') NOT NULL");
            }
        } catch (PDOException $e) {
            error_log('HeadTeacher ensureAssignmentRequestSchema Error: ' . $e->getMessage());
        }
    }

    private function loadPendingAssignmentRequest(int $requestId): ?array
    {
        $this->ensureAssignmentRequestSchema();

        $pdo = $this->pdo();
        $stmt = $pdo->prepare(
            "SELECT *
             FROM teacher_assignment_requests
             WHERE id = :id AND status = 'pending'
             LIMIT 1"
        );
        $stmt->execute([':id' => $requestId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private function applyApprovedAssignment(array $request): bool
    {
        $teacherId = (int)$request['teacher_id'];
        $targetId = (int)$request['target_id'];
        $type = (string)$request['assignment_type'];
        $classId = isset($request['class_id']) ? (int)$request['class_id'] : 0;
        $subjectId = isset($request['subject_id']) ? (int)$request['subject_id'] : 0;

        $m = new Teacher($this->userId(), $this->yearId(), $this->termId());
        $m->id = $teacherId;

        if ($type === 'both') {
            $resolvedClassId = $classId > 0 ? $classId : $targetId;
            if ($resolvedClassId <= 0 || $subjectId <= 0) return false;

            $pdo = $this->pdo();
            $conflict = $pdo->prepare(
                "SELECT id, teacher_id
                 FROM teacher_assignment_requests
                 WHERE assignment_type = 'both'
                   AND class_id = :class_id
                   AND subject_id = :subject_id
                   AND status = 'approved'
                   AND teacher_id <> :teacher_id
                 LIMIT 1"
            );
            $conflict->execute([
                ':class_id' => $resolvedClassId,
                ':subject_id' => $subjectId,
                ':teacher_id' => $teacherId,
            ]);
            if ($conflict->fetchColumn()) return false;

            $okClass = $m->assignClass($resolvedClassId);
            if (!$okClass) return false;

            return $m->assignSubject($subjectId);
        }

        if ($type === 'class') return $m->assignClass($targetId);
        if ($type === 'subject') return $m->assignSubject($targetId);

        return false;
    }

    // =========================
    // GET /api/head/dashboard
    // head_teacher only
    // =========================
    public function dashboard(): void
    {
        $this->requireRole(['head_teacher']);

        $pdo   = $this->pdo();
        $today = date('Y-m-d');

        $students = (int)$pdo->query("SELECT COUNT(*) FROM students")->fetchColumn();
        $teachers = (int)$pdo->query("SELECT COUNT(*) FROM teachers")->fetchColumn();
        $classes  = (int)$pdo->query("SELECT COUNT(*) FROM classes")->fetchColumn();

        // Attendance today per class
        $stmt = $pdo->prepare("
            SELECT c.id AS class_id, c.name AS class_name, c.form_id,
                   COUNT(a.id) AS records
            FROM classes c
            LEFT JOIN attendance a
              ON a.class_id = c.id AND a.attendance_date = :dt
            GROUP BY c.id
            ORDER BY c.form_id ASC, c.name ASC
        ");
        $stmt->execute([':dt' => $today]);
        $attendance = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Latest exams
        $stmt = $pdo->query("
            SELECT id, name, exam_type, start_date, end_date
            FROM exams
            ORDER BY end_date DESC, start_date DESC
            LIMIT 5
        ");
        $latestExams = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $this->json([
            'ok' => true,
            'data' => [
                'date' => $today,
                'counts' => [
                    'students' => $students,
                    'teachers' => $teachers,
                    'classes'  => $classes
                ],
                'attendance_today' => $attendance,
                'latest_exams' => $latestExams
            ]
        ]);
    }

    // =========================
    // TEACHERS MANAGEMENT
    // (head_teacher only)
    // =========================

    // POST /api/head/teachers/create
    public function createTeacher(): void
    {
        $this->requireRole(['head_teacher']);

        $data = $this->request();

        $m = new Teacher($this->userId(), $this->yearId(), $this->termId());
        $m->teacher_code  = $data['teacher_code'] ?? null;
        $m->firstname     = trim((string)($data['firstname'] ?? ''));
        $m->lastname      = trim((string)($data['lastname'] ?? ''));
        $m->contact_no    = $data['contact_no'] ?? null;
        $m->role          = $data['role'] ?? 'teacher';
        $m->department_id = isset($data['department_id']) && $data['department_id'] !== '' ? (int)$data['department_id'] : null;

        if ($m->firstname === '' || $m->lastname === '') {
            $this->json(['ok' => false, 'error' => 'firstname and lastname are required'], 400);
        }

        if ($m->create()) {
            $this->json(['ok' => true, 'id' => (int)$m->id]);
        }
        $this->json(['ok' => false, 'error' => 'Failed to create teacher'], 500);
    }

    // POST /api/head/teachers/update
    public function updateTeacher(): void
    {
        $this->requireRole(['head_teacher']);

        $data = $this->request();
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) $this->json(['ok' => false, 'error' => 'Invalid id'], 400);

        $m = new Teacher($this->userId(), $this->yearId(), $this->termId());
        $m->id           = $id;
        $m->teacher_code = $data['teacher_code'] ?? null;
        $m->firstname    = trim((string)($data['firstname'] ?? ''));
        $m->lastname     = trim((string)($data['lastname'] ?? ''));
        $m->contact_no   = $data['contact_no'] ?? null;
        $m->role         = $data['role'] ?? 'teacher';
        $m->department_id = isset($data['department_id']) && $data['department_id'] !== '' ? (int)$data['department_id'] : null;

        if ($m->firstname === '' || $m->lastname === '') {
            $this->json(['ok' => false, 'error' => 'firstname and lastname are required'], 400);
        }

        if ($m->update()) {
            $this->json(['ok' => true]);
        }
        $this->json(['ok' => false, 'error' => 'Failed to update teacher'], 500);
    }

    // POST /api/head/teachers/delete
    public function deleteTeacher(): void
    {
        $this->requireRole(['head_teacher']);

        $data = $this->request();
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) $this->json(['ok' => false, 'error' => 'Invalid id'], 400);

        $m = new Teacher($this->userId(), $this->yearId(), $this->termId());
        $m->id = $id;

        if ($m->delete()) {
            $this->json(['ok' => true]);
        }
        $this->json(['ok' => false, 'error' => 'Failed to delete teacher'], 500);
    }

    // GET /api/head/teachers
    public function teachers(): void
    {
        $this->requireRole(['head_teacher']);

        $pdo = $this->pdo();
        $stmt = $pdo->query("
            SELECT t.*, d.name AS department_name
            FROM teachers t
            LEFT JOIN departments d ON d.id = t.department_id
            ORDER BY t.lastname ASC, t.firstname ASC
        ");
        $this->json(['ok' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }

    // =========================
    // ASSIGNMENTS (head_teacher approval)
    // =========================

    // POST /app/head/assign-class
    // Deprecated direct path; only HOD can create requests.
    public function assignClass(): void
    {
        $this->requireRole(['head_teacher']);
        $this->json(['ok' => false, 'error' => 'Direct assignment disabled. Use assignment request approval endpoint.'], 403);
    }

    // POST /app/head/assign-subject
    // Deprecated direct path; only HOD can create requests.
    public function assignSubject(): void
    {
        $this->requireRole(['head_teacher']);
        $this->json(['ok' => false, 'error' => 'Direct assignment disabled. Use assignment request approval endpoint.'], 403);
    }

    // GET /app/head/assignment-requests?status=pending
    public function assignmentRequests(): void
    {
        $this->requireRole(['head_teacher']);
        $this->ensureAssignmentRequestSchema();

        $status = trim((string)($_GET['status'] ?? 'pending'));
        $allowedStatuses = ['pending', 'approved', 'rejected'];
        if (!in_array($status, $allowedStatuses, true)) {
            $this->json(['ok' => false, 'error' => 'Invalid status'], 400);
        }

        $pdo = $this->pdo();
        $stmt = $pdo->prepare(
            "SELECT r.id, r.teacher_id, r.assignment_type, r.target_id,
                COALESCE(r.class_id, CASE WHEN r.assignment_type IN ('class', 'both') THEN r.target_id ELSE NULL END) AS class_id,
                COALESCE(r.subject_id, CASE WHEN r.assignment_type = 'subject' THEN r.target_id ELSE NULL END) AS subject_id,
                c.name AS class_name,
                s.name AS subject_name,
                r.status,
                    r.requested_by, r.approved_by, r.decision_note,
                    r.created_at, r.approved_at,
                    t.firstname, t.lastname,
                    req.firstname AS requested_by_firstname,
                    req.lastname AS requested_by_lastname,
                    appr.firstname AS approved_by_firstname,
                    appr.lastname AS approved_by_lastname
             FROM teacher_assignment_requests r
             JOIN teachers t ON t.id = r.teacher_id
             JOIN teachers req ON req.id = r.requested_by
             LEFT JOIN classes c ON c.id = COALESCE(r.class_id, CASE WHEN r.assignment_type IN ('class', 'both') THEN r.target_id ELSE NULL END)
             LEFT JOIN subjects s ON s.id = COALESCE(r.subject_id, CASE WHEN r.assignment_type = 'subject' THEN r.target_id ELSE NULL END)
             LEFT JOIN teachers appr ON appr.id = r.approved_by
             WHERE r.status = :status
             ORDER BY r.created_at DESC"
        );
        $stmt->execute([':status' => $status]);

        $this->json(['ok' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }

    // POST /app/head/assignment-requests/approve
    // body: request_id, decision_note(optional)
    public function approveAssignmentRequest(): void
    {
        $this->requireRole(['head_teacher']);

        $data = $this->request();
        $requestId = (int)($data['request_id'] ?? 0);
        $note = trim((string)($data['decision_note'] ?? ''));
        if ($requestId <= 0) {
            $this->json(['ok' => false, 'error' => 'request_id is required'], 400);
        }

        $request = $this->loadPendingAssignmentRequest($requestId);
        if (!$request) {
            $this->json(['ok' => false, 'error' => 'Pending request not found'], 404);
        }

        if ((string)$request['assignment_type'] === 'both') {
            $classId = (int)($request['class_id'] ?? 0);
            $subjectId = (int)($request['subject_id'] ?? 0);
            $teacherId = (int)($request['teacher_id'] ?? 0);
            $pdo = $this->pdo();
            $conflict = $pdo->prepare(
                "SELECT id
                 FROM teacher_assignment_requests
                 WHERE assignment_type = 'both'
                   AND class_id = :class_id
                   AND subject_id = :subject_id
                   AND status = 'approved'
                   AND teacher_id <> :teacher_id
                 LIMIT 1"
            );
            $conflict->execute([
                ':class_id' => $classId,
                ':subject_id' => $subjectId,
                ':teacher_id' => $teacherId,
            ]);
            if ($conflict->fetchColumn()) {
                $this->json(['ok' => false, 'error' => 'This subject is already allocated to another teacher for that class'], 409);
            }
        }

        if (!$this->applyApprovedAssignment($request)) {
            $this->json(['ok' => false, 'error' => 'Failed to apply assignment during approval'], 500);
        }

        $pdo = $this->pdo();
        $stmt = $pdo->prepare(
            "UPDATE teacher_assignment_requests
             SET status = 'approved', approved_by = :approved_by, approved_at = NOW(), decision_note = :decision_note
             WHERE id = :id AND status = 'pending'"
        );
        $ok = $stmt->execute([
            ':approved_by' => $this->userId(),
            ':decision_note' => ($note !== '' ? $note : null),
            ':id' => $requestId,
        ]);

        if ($ok && $stmt->rowCount() > 0) {
            $this->json(['ok' => true, 'status' => 'approved']);
        }

        $this->json(['ok' => false, 'error' => 'Failed to mark request approved'], 500);
    }

    // POST /app/head/assignment-requests/reject
    // body: request_id, decision_note(optional)
    public function rejectAssignmentRequest(): void
    {
        $this->requireRole(['head_teacher']);

        $data = $this->request();
        $requestId = (int)($data['request_id'] ?? 0);
        $note = trim((string)($data['decision_note'] ?? ''));
        if ($requestId <= 0) {
            $this->json(['ok' => false, 'error' => 'request_id is required'], 400);
        }

        $request = $this->loadPendingAssignmentRequest($requestId);
        if (!$request) {
            $this->json(['ok' => false, 'error' => 'Pending request not found'], 404);
        }

        $pdo = $this->pdo();
        $stmt = $pdo->prepare(
            "UPDATE teacher_assignment_requests
             SET status = 'rejected', approved_by = :approved_by, approved_at = NOW(), decision_note = :decision_note
             WHERE id = :id AND status = 'pending'"
        );
        $ok = $stmt->execute([
            ':approved_by' => $this->userId(),
            ':decision_note' => ($note !== '' ? $note : null),
            ':id' => $requestId,
        ]);

        if ($ok && $stmt->rowCount() > 0) {
            $this->json(['ok' => true, 'status' => 'rejected']);
        }

        $this->json(['ok' => false, 'error' => 'Failed to reject request'], 500);
    }

    // =========================
    // EXAMS
    // (head_teacher only)
    // =========================

    // GET /api/head/subjects
    public function subjects(): void
    {
        $this->requireRole(['head_teacher']);

        $pdo = $this->pdo();
        $stmt = $pdo->query("SELECT id, name FROM subjects ORDER BY name ASC");
        $this->json(['ok' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }

    // GET /api/head/exams
    public function exams(): void
    {
        $this->requireRole(['head_teacher']);

        $pdo = $this->pdo();
        $stmt = $pdo->query("
            SELECT id, name, exam_type, start_date, end_date, academic_year_id, term_id
            FROM exams
            ORDER BY end_date DESC, start_date DESC
        ");
        $this->json(['ok' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }

    // POST /api/head/exams/create
    // body: name, exam_type, start_date, end_date, subject_ids[]
    public function createExam(): void
    {
        $this->requireRole(['head_teacher']);

        $data = $this->request();

        $name = trim((string)($data['name'] ?? ''));
        $type = (string)($data['exam_type'] ?? '');
        $startDate = trim((string)($data['start_date'] ?? ''));
        $endDate = trim((string)($data['end_date'] ?? ''));
        $legacyDate = trim((string)($data['exam_date'] ?? ''));

        if ($startDate === '' && $legacyDate !== '') $startDate = $legacyDate;
        if ($endDate === '' && $legacyDate !== '') $endDate = $legacyDate;
        $subjectIds = $data['subject_ids'] ?? [];

        if ($name === '' || $type === '' || $startDate === '' || $endDate === '') {
            $this->json(['ok' => false, 'error' => 'name, exam_type, start_date and end_date are required'], 400);
        }

        if (!is_array($subjectIds)) $subjectIds = [];

        $m = new Exam($this->userId(), $this->yearId(), $this->termId());
        $m->name = $name;
        $m->exam_type = $type;
        $m->start_date = $startDate;
        $m->end_date = $endDate;

        if ($m->create($subjectIds)) {
            $this->json(['ok' => true, 'id' => (int)$m->id]);
        }

        $this->json(['ok' => false, 'error' => 'Failed to create exam'], 500);
    }

    // GET /api/head/exams/subjects?exam_id=1
    public function examSubjects(): void
    {
        $this->requireRole(['head_teacher']);

        $examId = (int)($_GET['exam_id'] ?? 0);
        if ($examId <= 0) $this->json(['ok' => false, 'error' => 'Invalid exam_id'], 400);

        $m = new Exam($this->userId(), $this->yearId(), $this->termId());
        $m->id = $examId;

        $this->json(['ok' => true, 'data' => $m->getSubjects()]);
    }
}
