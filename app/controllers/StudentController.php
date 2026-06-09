<?php
require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/Student.php';

class StudentController extends BaseController
{
    // ---------------------------------------------------------
    // Helpers (controller-only)
    // ---------------------------------------------------------
    private function teacherCanAccessStudent(int $teacherId, int $studentId): bool
    {
        $classId = $this->studentClassId($studentId);
        if (!$classId) return false;
        return $this->teacherHasClass($teacherId, $classId);
    }

    private function hodCanAccessStudent(int $hodId, int $studentId): bool
    {
        $deptId = $this->hodDepartmentId($hodId);
        if (!$deptId) return false;

        $pdo = $this->pdo();

        // Student -> class -> teacher_classes -> teachers.department_id
        // If ANY teacher in this department is assigned to the student's class, allow HOD view.
        $stmt = $pdo->prepare("
            SELECT 1
            FROM students s
            JOIN teacher_classes tc ON tc.class_id = s.class_id
            JOIN teachers t ON t.id = tc.teacher_id
            WHERE s.id = :sid
              AND t.department_id = :dept
            LIMIT 1
        ");
        $stmt->execute([':sid' => $studentId, ':dept' => $deptId]);
        return (bool)$stmt->fetchColumn();
    }

    // ---------------------------------------------------------
    // GET /api/students
    // head_teacher: all students
    // hod: students in classes handled by teachers in their dept
    // teacher: students in my assigned classes
    // ---------------------------------------------------------
    public function index(): void
    {
        $this->requireAuth();

        $pdo  = $this->pdo();
        $role = $this->role();
        $uid  = $this->userId();

        if ($role === 'head_teacher') {
            $m = new Student($uid, $this->yearId(), $this->termId());
            $this->json(['ok' => true, 'data' => $m->getAll()]);
        }

        if ($role === 'teacher') {
            $stmt = $pdo->prepare("
                SELECT DISTINCT s.*
                FROM students s
                JOIN teacher_classes tc ON tc.class_id = s.class_id
                WHERE tc.teacher_id = :tid
                ORDER BY s.lname ASC, s.fname ASC
            ");
            $stmt->execute([':tid' => $uid]);
            $this->json(['ok' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        }

        // HOD
        if ($role === 'hod') {
            $deptId = $this->hodDepartmentId($uid);
            if (!$deptId) $this->json(['ok' => true, 'data' => []]);

            $stmt = $pdo->prepare("
                SELECT DISTINCT s.*
                FROM students s
                JOIN teacher_classes tc ON tc.class_id = s.class_id
                JOIN teachers t ON t.id = tc.teacher_id
                WHERE t.department_id = :dept
                ORDER BY s.lname ASC, s.fname ASC
            ");
            $stmt->execute([':dept' => $deptId]);
            $this->json(['ok' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
        }

        // default deny for unknown roles
        $this->json(['ok' => false, 'error' => 'Forbidden'], 403);
    }

    // ---------------------------------------------------------
    // GET /api/students/show?id=1
    // head_teacher: any
    // hod: department scope
    // teacher: only if student in my class
    // ---------------------------------------------------------
    public function show(): void
    {
        $this->requireAuth();

        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) $this->json(['ok' => false, 'error' => 'Invalid id'], 400);

        $role = $this->role();
        $uid  = $this->userId();

        if ($role === 'teacher' && !$this->teacherCanAccessStudent($uid, $id)) {
            $this->json(['ok' => false, 'error' => 'Forbidden'], 403);
        }

        if ($role === 'hod' && !$this->hodCanAccessStudent($uid, $id)) {
            $this->json(['ok' => false, 'error' => 'Forbidden'], 403);
        }

        $m = new Student($uid, $this->yearId(), $this->termId());
        $row = $m->getById($id);

        if (!$row) $this->json(['ok' => false, 'error' => 'Student not found'], 404);

        $this->json(['ok' => true, 'data' => $row]);
    }

    // ---------------------------------------------------------
    // POST /api/students/create
    // Head Teacher only (registration)
    // ---------------------------------------------------------
    public function create(): void
    {
        $this->requireRole(['head_teacher']);

        $data = $this->request();

        $m = new Student($this->userId(), $this->yearId(), $this->termId());
        $m->student_code     = $data['student_code'] ?? null;
        $m->fname            = trim((string)($data['fname'] ?? ''));
        $m->lname            = trim((string)($data['lname'] ?? ''));
        $m->class_id         = (int)($data['class_id'] ?? 0);
        $m->form_id          = (int)($data['form_id'] ?? 0);
        $m->dob              = $data['dob'] ?? null;
        $m->home             = $data['home'] ?? null;
        $m->parent_contact   = $data['parent_contact'] ?? null;

        $m->academic_year_id = $this->yearId();
        $m->term_id          = $this->termId();

        if ($m->fname === '' || $m->lname === '' || $m->class_id <= 0 || $m->form_id <= 0) {
            $this->json(['ok' => false, 'error' => 'fname, lname, class_id, form_id are required'], 400);
        }

        if ($m->create()) {
            $this->json(['ok' => true, 'id' => (int)$m->id]);
        }

        $this->json(['ok' => false, 'error' => 'Failed to create student'], 500);
    }

    // ---------------------------------------------------------
    // POST /api/students/update
    // Head Teacher only
    // ---------------------------------------------------------
    public function update(): void
    {
        $this->requireRole(['head_teacher']);

        $data = $this->request();
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) $this->json(['ok' => false, 'error' => 'Invalid id'], 400);

        $m = new Student($this->userId(), $this->yearId(), $this->termId());
        $m->id              = $id;
        $m->student_code    = $data['student_code'] ?? null;
        $m->fname           = trim((string)($data['fname'] ?? ''));
        $m->lname           = trim((string)($data['lname'] ?? ''));
        $m->class_id        = (int)($data['class_id'] ?? 0);
        $m->form_id         = (int)($data['form_id'] ?? 0);
        $m->dob             = $data['dob'] ?? null;
        $m->home            = $data['home'] ?? null;
        $m->parent_contact  = $data['parent_contact'] ?? null;

        $m->academic_year_id = $this->yearId();
        $m->term_id          = $this->termId();

        if ($m->fname === '' || $m->lname === '' || $m->class_id <= 0 || $m->form_id <= 0) {
            $this->json(['ok' => false, 'error' => 'fname, lname, class_id, form_id are required'], 400);
        }

        if ($m->update()) {
            $this->json(['ok' => true]);
        }

        $this->json(['ok' => false, 'error' => 'Failed to update student'], 500);
    }

    // ---------------------------------------------------------
    // POST /api/students/delete
    // Head Teacher only
    // ---------------------------------------------------------
    public function delete(): void
    {
        $this->requireRole(['head_teacher']);

        $data = $this->request();
        $id = (int)($data['id'] ?? 0);
        if ($id <= 0) $this->json(['ok' => false, 'error' => 'Invalid id'], 400);

        $m = new Student($this->userId(), $this->yearId(), $this->termId());
        $m->id = $id;

        if ($m->delete()) {
            $this->json(['ok' => true]);
        }

        $this->json(['ok' => false, 'error' => 'Failed to delete student'], 500);
    }

    // ---------------------------------------------------------
    // POST /app/students/assign-class
    // Head Teacher only
    // body: class_id + (student_id OR student_ids[])
    // ---------------------------------------------------------
    public function assignClass(): void
    {
        $this->requireRole(['head_teacher']);

        $data = $this->request();
        $classId = (int)($data['class_id'] ?? 0);

        if ($classId <= 0) {
            $this->json(['ok' => false, 'error' => 'class_id is required'], 400);
        }

        $studentIds = [];
        $singleStudentId = (int)($data['student_id'] ?? 0);
        if ($singleStudentId > 0) {
            $studentIds[] = $singleStudentId;
        }

        if (isset($data['student_ids']) && is_array($data['student_ids'])) {
            foreach ($data['student_ids'] as $sid) {
                $sidInt = (int)$sid;
                if ($sidInt > 0) $studentIds[] = $sidInt;
            }
        }

        $studentIds = array_values(array_unique($studentIds));
        if (count($studentIds) === 0) {
            $this->json(['ok' => false, 'error' => 'student_id or student_ids[] is required'], 400);
        }

        $pdo = $this->pdo();

        $classStmt = $pdo->prepare("SELECT id, form_id FROM classes WHERE id = :id LIMIT 1");
        $classStmt->execute([':id' => $classId]);
        $classRow = $classStmt->fetch(PDO::FETCH_ASSOC);

        if (!$classRow) {
            $this->json(['ok' => false, 'error' => 'class_id does not exist'], 400);
        }

        $formId = (int)($classRow['form_id'] ?? 0);
        if ($formId <= 0) {
            $this->json(['ok' => false, 'error' => 'Selected class has no valid form_id'], 400);
        }

        $updateStmt = $pdo->prepare(
            "UPDATE students
             SET class_id = :class_id,
                 form_id = :form_id,
                 academic_year_id = :academic_year_id,
                 term_id = :term_id
             WHERE id = :student_id"
        );

        $updated = 0;
        $missing = [];

        try {
            $pdo->beginTransaction();

            foreach ($studentIds as $studentId) {
                $existsStmt = $pdo->prepare("SELECT 1 FROM students WHERE id = :id LIMIT 1");
                $existsStmt->execute([':id' => $studentId]);
                if (!$existsStmt->fetchColumn()) {
                    $missing[] = $studentId;
                    continue;
                }

                $updateStmt->execute([
                    ':class_id' => $classId,
                    ':form_id' => $formId,
                    ':academic_year_id' => $this->yearId(),
                    ':term_id' => $this->termId(),
                    ':student_id' => $studentId,
                ]);
                $updated++;
            }

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            $this->json(['ok' => false, 'error' => 'Failed to assign students to class'], 500);
        }

        $this->json([
            'ok' => true,
            'data' => [
                'class_id' => $classId,
                'form_id' => $formId,
                'updated_count' => $updated,
                'missing_student_ids' => $missing,
            ],
        ]);
    }

    // ---------------------------------------------------------
    // GET /api/students/attendance?id=1
    // head_teacher: any
    // hod: dept scope
    // teacher: only if student in my class
    // ---------------------------------------------------------
    public function attendance(): void
    {
        $this->requireAuth();

        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) $this->json(['ok' => false, 'error' => 'Invalid id'], 400);

        $role = $this->role();
        $uid  = $this->userId();

        if ($role === 'teacher' && !$this->teacherCanAccessStudent($uid, $id)) {
            $this->json(['ok' => false, 'error' => 'Forbidden'], 403);
        }

        if ($role === 'hod' && !$this->hodCanAccessStudent($uid, $id)) {
            $this->json(['ok' => false, 'error' => 'Forbidden'], 403);
        }

        $m = new Student($uid, $this->yearId(), $this->termId());
        $m->id = $id;

        $rows = $m->getAttendance();
        $this->json(['ok' => true, 'data' => $rows]);
    }

    // ---------------------------------------------------------
    // GET /api/students/grades?id=1
    // head_teacher: any
    // hod: dept scope
    // teacher: only if student in my class
    // ---------------------------------------------------------
    public function grades(): void
    {
        $this->requireAuth();

        $id = (int)($_GET['id'] ?? 0);
        if ($id <= 0) $this->json(['ok' => false, 'error' => 'Invalid id'], 400);

        $role = $this->role();
        $uid  = $this->userId();

        if ($role === 'teacher' && !$this->teacherCanAccessStudent($uid, $id)) {
            $this->json(['ok' => false, 'error' => 'Forbidden'], 403);
        }

        if ($role === 'hod' && !$this->hodCanAccessStudent($uid, $id)) {
            $this->json(['ok' => false, 'error' => 'Forbidden'], 403);
        }

        $m = new Student($uid, $this->yearId(), $this->termId());
        $m->id = $id;

        $rows = $m->getGrades();
        $this->json(['ok' => true, 'data' => $rows]);
    }
}
