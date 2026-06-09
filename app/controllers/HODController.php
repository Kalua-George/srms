<?php
require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/Teacher.php';

class HODController extends BaseController
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
            error_log('HOD ensureAssignmentRequestSchema Error: ' . $e->getMessage());
        }
    }

    private function ensureTeacherInMyDepartment(int $teacherId): int
    {
        $pdo = $this->pdo();
        $deptId = $this->hodDepartmentId($this->userId());
        if (!$deptId) $this->json(['ok' => false, 'error' => 'HOD department not found'], 403);

        $stmt = $pdo->prepare("SELECT 1 FROM teachers WHERE id=:tid AND department_id=:dept LIMIT 1");
        $stmt->execute([':tid' => $teacherId, ':dept' => $deptId]);
        if (!$stmt->fetchColumn()) {
            $this->json(['ok' => false, 'error' => 'Forbidden'], 403);
        }

        return (int)$deptId;
    }

    private function createAssignmentRequest(int $teacherId, string $type, int $targetId): ?int
    {
        try {
            $pdo = $this->pdo();

            $check = $pdo->prepare(
                "SELECT id
                 FROM teacher_assignment_requests
                 WHERE teacher_id = :teacher_id
                   AND assignment_type = :assignment_type
                   AND target_id = :target_id
                   AND status = 'pending'
                 LIMIT 1"
            );
            $check->execute([
                ':teacher_id' => $teacherId,
                ':assignment_type' => $type,
                ':target_id' => $targetId,
            ]);

            $existingId = $check->fetchColumn();
            if ($existingId) {
                return (int)$existingId;
            }

            $deptId = $this->ensureTeacherInMyDepartment($teacherId);

            $stmt = $pdo->prepare(
                "INSERT INTO teacher_assignment_requests
                 (teacher_id, assignment_type, target_id, requested_by, requested_by_department_id, status, academic_year_id, term_id)
                 VALUES
                 (:teacher_id, :assignment_type, :target_id, :requested_by, :requested_by_department_id, 'pending', :academic_year_id, :term_id)"
            );
            $ok = $stmt->execute([
                ':teacher_id' => $teacherId,
                ':assignment_type' => $type,
                ':target_id' => $targetId,
                ':requested_by' => $this->userId(),
                ':requested_by_department_id' => $deptId,
                ':academic_year_id' => $this->yearId(),
                ':term_id' => $this->termId(),
            ]);

            if (!$ok) return null;
            return (int)$pdo->lastInsertId();

        } catch (PDOException $e) {
            error_log("HOD createAssignmentRequest Error: " . $e->getMessage());
            return null;
        }
    }

    private function createCombinedAssignmentRequest(int $teacherId, int $classId, int $subjectId): ?int
    {
        try {
            $this->ensureAssignmentRequestSchema();
            $pdo = $this->pdo();

            $conflict = $pdo->prepare(
                "SELECT id, teacher_id, status
                 FROM teacher_assignment_requests
                 WHERE assignment_type = 'both'
                   AND class_id = :class_id
                   AND subject_id = :subject_id
                   AND status IN ('pending', 'approved')
                 ORDER BY FIELD(status, 'approved', 'pending') ASC, id DESC
                 LIMIT 1"
            );
            $conflict->execute([
                ':class_id' => $classId,
                ':subject_id' => $subjectId,
            ]);
            $conflictRow = $conflict->fetch(PDO::FETCH_ASSOC);
            if ($conflictRow) {
                $ownerTeacherId = (int)($conflictRow['teacher_id'] ?? 0);
                if ($ownerTeacherId !== $teacherId) {
                    return null;
                }
            }

            $check = $pdo->prepare(
                "SELECT id
                 FROM teacher_assignment_requests
                 WHERE teacher_id = :teacher_id
                   AND assignment_type = 'both'
                   AND class_id = :class_id
                   AND subject_id = :subject_id
                   AND status IN ('pending', 'approved')
                 LIMIT 1"
            );
            $check->execute([
                ':teacher_id' => $teacherId,
                ':class_id' => $classId,
                ':subject_id' => $subjectId,
            ]);

            $existingId = $check->fetchColumn();
            if ($existingId) {
                return (int)$existingId;
            }

            $deptId = $this->ensureTeacherInMyDepartment($teacherId);

            $stmt = $pdo->prepare(
                "INSERT INTO teacher_assignment_requests
                 (teacher_id, assignment_type, target_id, class_id, subject_id, requested_by, requested_by_department_id, status, academic_year_id, term_id)
                 VALUES
                 (:teacher_id, 'both', :target_id, :class_id, :subject_id, :requested_by, :requested_by_department_id, 'pending', :academic_year_id, :term_id)"
            );
            $ok = $stmt->execute([
                ':teacher_id' => $teacherId,
                ':target_id' => $classId,
                ':class_id' => $classId,
                ':subject_id' => $subjectId,
                ':requested_by' => $this->userId(),
                ':requested_by_department_id' => $deptId,
                ':academic_year_id' => $this->yearId(),
                ':term_id' => $this->termId(),
            ]);

            if (!$ok) return null;
            return (int)$pdo->lastInsertId();
        } catch (PDOException $e) {
            error_log("HOD createCombinedAssignmentRequest Error: " . $e->getMessage());
            return null;
        }
    }

    // =========================
    // GET /api/hod/dashboard
    // HOD only
    // =========================
    public function dashboard(): void
    {
        $this->requireRole(['hod']);

        $pdo   = $this->pdo();
        $hodId = $this->userId();

        $deptId = $this->hodDepartmentId($hodId);
        if (!$deptId) {
            $this->json([
                'ok' => true,
                'data' => [
                    'department_id' => null,
                    'teachers' => [],
                    'summary' => [
                        'teachers_total' => 0,
                        'teachers_with_classes' => 0,
                        'teachers_with_subjects' => 0
                    ]
                ]
            ]);
        }

        // Teachers in my department
        $stmt = $pdo->prepare("
            SELECT id, teacher_code, firstname, lastname, role, department_id
            FROM teachers
            WHERE department_id = :dept
            ORDER BY lastname ASC, firstname ASC
        ");
        $stmt->execute([':dept' => $deptId]);
        $teachers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Summary: assigned classes/subjects counts
        $withClasses  = 0;
        $withSubjects = 0;

        foreach ($teachers as $t) {
            $st = $pdo->prepare("SELECT 1 FROM teacher_classes WHERE teacher_id=:tid LIMIT 1");
            $st->execute([':tid' => (int)$t['id']]);
            if ($st->fetchColumn()) $withClasses++;

            $st = $pdo->prepare("SELECT 1 FROM teacher_subjects WHERE teacher_id=:tid LIMIT 1");
            $st->execute([':tid' => (int)$t['id']]);
            if ($st->fetchColumn()) $withSubjects++;
        }

        // Department name (nice for UI)
        $stmt = $pdo->prepare("SELECT name FROM departments WHERE id=:id LIMIT 1");
        $stmt->execute([':id' => $deptId]);
        $deptName = $stmt->fetchColumn() ?: null;

        $this->json([
            'ok' => true,
            'data' => [
                'department_id' => $deptId,
                'department_name' => $deptName,
                'teachers' => $teachers,
                'summary' => [
                    'teachers_total' => count($teachers),
                    'teachers_with_classes' => $withClasses,
                    'teachers_with_subjects' => $withSubjects
                ]
            ]
        ]);
    }

    // =========================
    // GET /api/hod/teachers
    // HOD only (teachers in their department)
    // =========================
    public function teachers(): void
    {
        $this->requireRole(['hod']);

        $pdo   = $this->pdo();
        $deptId = $this->hodDepartmentId($this->userId());
        if (!$deptId) $this->json(['ok' => true, 'data' => []]);

        $stmt = $pdo->prepare("
            SELECT t.*, d.name AS department_name
            FROM teachers t
            LEFT JOIN departments d ON t.department_id = d.id
            WHERE t.department_id = :dept
            ORDER BY t.lastname ASC, t.firstname ASC
        ");
        $stmt->execute([':dept' => $deptId]);
        $this->json(['ok' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }

    // =========================
    // GET /app/hod/classes
    // HOD only (all classes for assignment options)
    // =========================
    public function classes(): void
    {
        $this->requireRole(['hod']);

        $pdo = $this->pdo();
        $stmt = $pdo->query(
            "SELECT id, name, form_id
             FROM classes
             ORDER BY form_id ASC, name ASC"
        );

        $this->json(['ok' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }

    // =========================
    // GET /app/hod/department-subjects
    // HOD only (subjects in HOD department)
    // =========================
    public function departmentSubjects(): void
    {
        $this->requireRole(['hod']);

        $pdo = $this->pdo();
        $deptId = $this->hodDepartmentId($this->userId());
        if (!$deptId) {
            $this->json(['ok' => true, 'data' => []]);
        }

        try {
            $stmt = $pdo->prepare(
                "SELECT id, name
                 FROM subjects
                 WHERE department_id = :dept
                 ORDER BY name ASC"
            );
            $stmt->execute([':dept' => $deptId]);
            $this->json(['ok' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        } catch (PDOException $e) {
            error_log('HOD departmentSubjects Error: ' . $e->getMessage());
            $this->json(['ok' => false, 'error' => 'Failed to load department subjects'], 500);
        }
    }

    // =========================
    // POST /api/hod/assign-class
    // HOD only (teacher must be in HOD department)
    // Creates a pending request; head_teacher approval is required.
    // body: teacher_id, class_id
    // =========================
    public function assignClass(): void
    {
        $this->requireRole(['hod']);

        $data = $this->request();
        $teacherId = (int)($data['teacher_id'] ?? 0);
        $classId   = (int)($data['class_id'] ?? 0);

        if ($teacherId <= 0 || $classId <= 0) {
            $this->json(['ok' => false, 'error' => 'teacher_id and class_id are required'], 400);
        }

        $this->ensureTeacherInMyDepartment($teacherId);

        $pdo = $this->pdo();
        $exists = $pdo->prepare("SELECT 1 FROM classes WHERE id = :id LIMIT 1");
        $exists->execute([':id' => $classId]);
        if (!$exists->fetchColumn()) {
            $this->json(['ok' => false, 'error' => 'class_id does not exist'], 400);
        }

        $requestId = $this->createAssignmentRequest($teacherId, 'class', $classId);
        if ($requestId) {
            $this->json(['ok' => true, 'request_id' => $requestId, 'status' => 'pending_approval']);
        }

        $this->json(['ok' => false, 'error' => 'Failed to create assignment request'], 500);
    }

    // =========================
    // POST /api/hod/assign-subject
    // HOD only (teacher must be in HOD department)
    // Creates a pending request; head_teacher approval is required.
    // body: teacher_id, subject_id
    // =========================
    public function assignSubject(): void
    {
        $this->requireRole(['hod']);

        $data = $this->request();
        $teacherId = (int)($data['teacher_id'] ?? 0);
        $subjectId = (int)($data['subject_id'] ?? 0);

        if ($teacherId <= 0 || $subjectId <= 0) {
            $this->json(['ok' => false, 'error' => 'teacher_id and subject_id are required'], 400);
        }

        $this->ensureTeacherInMyDepartment($teacherId);

        $pdo = $this->pdo();
        $exists = $pdo->prepare("SELECT 1 FROM subjects WHERE id = :id LIMIT 1");
        $exists->execute([':id' => $subjectId]);
        if (!$exists->fetchColumn()) {
            $this->json(['ok' => false, 'error' => 'subject_id does not exist'], 400);
        }

        $requestId = $this->createAssignmentRequest($teacherId, 'subject', $subjectId);
        if ($requestId) {
            $this->json(['ok' => true, 'request_id' => $requestId, 'status' => 'pending_approval']);
        }

        $this->json(['ok' => false, 'error' => 'Failed to create assignment request'], 500);
    }

    // =========================
    // POST /app/hod/assign-both
    // HOD only (teacher must be in HOD department)
    // Creates pending class and subject requests in one submission.
    // body: teacher_id, class_id, subject_id
    // =========================
    public function assignBoth(): void
    {
        $this->requireRole(['hod']);

        $data = $this->request();
        $teacherId = (int)($data['teacher_id'] ?? 0);
        $classId = (int)($data['class_id'] ?? 0);
        $subjectId = (int)($data['subject_id'] ?? 0);

        if ($teacherId <= 0 || $classId <= 0 || $subjectId <= 0) {
            $this->json(['ok' => false, 'error' => 'teacher_id, class_id and subject_id are required'], 400);
        }

        $this->ensureTeacherInMyDepartment($teacherId);

        $pdo = $this->pdo();

        $classExists = $pdo->prepare("SELECT 1 FROM classes WHERE id = :id LIMIT 1");
        $classExists->execute([':id' => $classId]);
        if (!$classExists->fetchColumn()) {
            $this->json(['ok' => false, 'error' => 'class_id does not exist'], 400);
        }

        $subjectExists = $pdo->prepare("SELECT 1 FROM subjects WHERE id = :id LIMIT 1");
        $subjectExists->execute([':id' => $subjectId]);
        if (!$subjectExists->fetchColumn()) {
            $this->json(['ok' => false, 'error' => 'subject_id does not exist'], 400);
        }

        $conflictCheck = $pdo->prepare(
            "SELECT id, teacher_id, status
             FROM teacher_assignment_requests
             WHERE assignment_type = 'both'
               AND class_id = :class_id
               AND subject_id = :subject_id
               AND status IN ('pending', 'approved')
             ORDER BY FIELD(status, 'approved', 'pending') ASC, id DESC
             LIMIT 1"
        );
        $conflictCheck->execute([
            ':class_id' => $classId,
            ':subject_id' => $subjectId,
        ]);
        $conflictRow = $conflictCheck->fetch(PDO::FETCH_ASSOC);
        if ($conflictRow && (int)$conflictRow['teacher_id'] !== $teacherId) {
            $this->json(['ok' => false, 'error' => 'This subject is already allocated to another teacher for that class'], 409);
        }

        $requestId = $this->createCombinedAssignmentRequest($teacherId, $classId, $subjectId);
        if (!$requestId) {
            $this->json(['ok' => false, 'error' => 'This subject is already allocated for that class'], 409);
        }

        $this->json([
            'ok' => true,
            'request_id' => $requestId,
            'status' => 'pending_approval'
        ]);
    }

    // =========================
    // GET /app/hod/assignment-requests
    // HOD only (requests created by this HOD)
    // =========================
    public function assignmentRequests(): void
    {
        $this->requireRole(['hod']);
        $this->ensureAssignmentRequestSchema();

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
                    approver.firstname AS approver_firstname,
                    approver.lastname AS approver_lastname
             FROM teacher_assignment_requests r
             JOIN teachers t ON t.id = r.teacher_id
             LEFT JOIN classes c ON c.id = COALESCE(r.class_id, CASE WHEN r.assignment_type IN ('class', 'both') THEN r.target_id ELSE NULL END)
             LEFT JOIN subjects s ON s.id = COALESCE(r.subject_id, CASE WHEN r.assignment_type = 'subject' THEN r.target_id ELSE NULL END)
             LEFT JOIN teachers approver ON approver.id = r.approved_by
             WHERE r.requested_by = :hod_id
             ORDER BY r.created_at DESC"
        );
        $stmt->execute([':hod_id' => $this->userId()]);

        $this->json(['ok' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
    }

    // =========================
    // GET /api/hod/teacher-classes?teacher_id=1
    // HOD only (teacher must be in HOD department)
    // =========================
    public function teacherClasses(): void
    {
        $this->requireRole(['hod']);

        $teacherId = (int)($_GET['teacher_id'] ?? 0);
        if ($teacherId <= 0) $this->json(['ok' => false, 'error' => 'Invalid teacher_id'], 400);

        $pdo = $this->pdo();
        $deptId = $this->hodDepartmentId($this->userId());
        if (!$deptId) $this->json(['ok' => false, 'error' => 'HOD department not found'], 403);

        $stmt = $pdo->prepare("SELECT 1 FROM teachers WHERE id=:tid AND department_id=:dept LIMIT 1");
        $stmt->execute([':tid' => $teacherId, ':dept' => $deptId]);
        if (!$stmt->fetchColumn()) $this->json(['ok' => false, 'error' => 'Forbidden'], 403);

        $m = new Teacher($this->userId(), $this->yearId(), $this->termId());
        $m->id = $teacherId;

        $data = $m->getTeachingAssignments();
        $this->json(['ok' => true, 'data' => $data ?? []]);
    }

    // =========================
    // GET /api/hod/teacher-subjects?teacher_id=1
    // HOD only (teacher must be in HOD department)
    // =========================
    public function teacherSubjects(): void
    {
        $this->requireRole(['hod']);

        $teacherId = (int)($_GET['teacher_id'] ?? 0);
        if ($teacherId <= 0) $this->json(['ok' => false, 'error' => 'Invalid teacher_id'], 400);

        $pdo = $this->pdo();
        $deptId = $this->hodDepartmentId($this->userId());
        if (!$deptId) $this->json(['ok' => false, 'error' => 'HOD department not found'], 403);

        $stmt = $pdo->prepare("SELECT 1 FROM teachers WHERE id=:tid AND department_id=:dept LIMIT 1");
        $stmt->execute([':tid' => $teacherId, ':dept' => $deptId]);
        if (!$stmt->fetchColumn()) $this->json(['ok' => false, 'error' => 'Forbidden'], 403);

        $m = new Teacher($this->userId(), $this->yearId(), $this->termId());
        $m->id = $teacherId;

        $data = $m->getSubjects();
        $this->json(['ok' => true, 'data' => $data ?? []]);
    }
}
