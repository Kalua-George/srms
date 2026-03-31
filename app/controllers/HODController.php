<?php
require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/Teacher.php';

class HODController extends BaseController
{
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
    // GET /app/hod/assignment-requests
    // HOD only (requests created by this HOD)
    // =========================
    public function assignmentRequests(): void
    {
        $this->requireRole(['hod']);

        $pdo = $this->pdo();
        $stmt = $pdo->prepare(
            "SELECT r.id, r.teacher_id, r.assignment_type, r.target_id, r.status,
                    r.requested_by, r.approved_by, r.decision_note,
                    r.created_at, r.approved_at,
                    t.firstname, t.lastname,
                    approver.firstname AS approver_firstname,
                    approver.lastname AS approver_lastname
             FROM teacher_assignment_requests r
             JOIN teachers t ON t.id = r.teacher_id
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

        $data = json_decode($m->getClasses(), true);
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

        $data = json_decode($m->getSubjects(), true);
        $this->json(['ok' => true, 'data' => $data ?? []]);
    }
}
