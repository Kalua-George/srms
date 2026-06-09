<?php
require_once __DIR__ . '/BaseModel.php';

class Teacher extends BaseModel {
    private $table = 'teachers';

    public $id;
    public $teacher_code;
    public $firstname;
    public $lastname;
    public $contact_no;
    public $role;          // teacher, hod, head_teacher
    public $department_id;

    public function __construct($user_id = null, $academic_year_id = null, $term_id = null) {
        parent::__construct($user_id, $academic_year_id, $term_id);
    }

    // Create a new teacher
    public function create() {
        try {
            $query = "INSERT INTO {$this->table} 
                      (teacher_code, firstname, lastname, contact_no, role, department_id)
                      VALUES (:teacher_code, :firstname, :lastname, :contact_no, :role, :department_id)";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':teacher_code', $this->teacher_code);
            $stmt->bindParam(':firstname', $this->firstname);
            $stmt->bindParam(':lastname', $this->lastname);
            $stmt->bindParam(':contact_no', $this->contact_no);
            $stmt->bindParam(':role', $this->role);
            $stmt->bindParam(':department_id', $this->department_id);

            if ($stmt->execute()) {
                $this->id = $this->conn->lastInsertId();
                $this->logAction("Create Teacher", "Created teacher {$this->firstname} {$this->lastname} ({$this->teacher_code})");
                return true;
            }
        } catch (PDOException $e) {
            error_log("Teacher Create Error: " . $e->getMessage());
        }
        return false;
    }

    // Update teacher
    public function update() {
        try {
            $query = "UPDATE {$this->table} SET
                      teacher_code = :teacher_code,
                      firstname = :firstname,
                      lastname = :lastname,
                      contact_no = :contact_no,
                      role = :role,
                      department_id = :department_id
                      WHERE id = :id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':teacher_code', $this->teacher_code);
            $stmt->bindParam(':firstname', $this->firstname);
            $stmt->bindParam(':lastname', $this->lastname);
            $stmt->bindParam(':contact_no', $this->contact_no);
            $stmt->bindParam(':role', $this->role);
            $stmt->bindParam(':department_id', $this->department_id);
            $stmt->bindParam(':id', $this->id, PDO::PARAM_INT);

            if ($stmt->execute()) {
                $this->logAction("Update Teacher", "Updated Teacher ID {$this->id}");
                return true;
            }
        } catch (PDOException $e) {
            error_log("Teacher Update Error: " . $e->getMessage());
        }
        return false;
    }

    // Delete teacher
    public function delete() {
        try {
            $stmt = $this->conn->prepare("DELETE FROM {$this->table} WHERE id = :id");
            $stmt->bindParam(':id', $this->id, PDO::PARAM_INT);
            if ($stmt->execute()) {
                $this->logAction("Delete Teacher", "Deleted Teacher ID {$this->id}");
                return true;
            }
        } catch (PDOException $e) {
            error_log("Teacher Delete Error: " . $e->getMessage());
        }
        return false;
    }

    // Get all teachers
    public function getAll() {
        try {
            $stmt = $this->conn->prepare(
                "SELECT t.*, d.name AS department_name
                 FROM {$this->table} t
                 LEFT JOIN departments d ON t.department_id = d.id
                 ORDER BY t.lastname ASC"
            );
            $stmt->execute();
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Teacher GetAll Error: " . $e->getMessage());
            return [];
        }
    }

    // Get teacher by ID
    public function getById($id) {
        try {
            $stmt = $this->conn->prepare(
                "SELECT t.*, d.name AS department_name
                 FROM {$this->table} t
                 LEFT JOIN departments d ON t.department_id = d.id
                 WHERE t.id = :id
                 LIMIT 1"
            );
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Teacher GetById Error: " . $e->getMessage());
            return null;
        }
    }

    // Assign class
    public function assignClass($class_id) {
        try {
            $stmt = $this->conn->prepare("INSERT IGNORE INTO teacher_classes (teacher_id, class_id) VALUES (:teacher_id, :class_id)");
            $stmt->bindParam(':teacher_id', $this->id);
            $stmt->bindParam(':class_id', $class_id);
            if ($stmt->execute()) {
                $this->logAction("Assign Class", "Class {$class_id} → Teacher {$this->id}");
                return true;
            }
        } catch (PDOException $e) {
            error_log("Teacher AssignClass Error: " . $e->getMessage());
        }
        return false;
    }

    // Assign subject
    public function assignSubject($subject_id) {
        try {
            $stmt = $this->conn->prepare("INSERT IGNORE INTO teacher_subjects (teacher_id, subject_id) VALUES (:teacher_id, :subject_id)");
            $stmt->bindParam(':teacher_id', $this->id);
            $stmt->bindParam(':subject_id', $subject_id);
            if ($stmt->execute()) {
                $this->logAction("Assign Subject", "Subject {$subject_id} → Teacher {$this->id}");
                return true;
            }
        } catch (PDOException $e) {
            error_log("Teacher AssignSubject Error: " . $e->getMessage());
        }
        return false;
    }

    // Get classes assigned to teacher
    public function getClasses() {
        try {
            $stmt = $this->conn->prepare(
                "SELECT c.* 
                 FROM teacher_classes tc
                 JOIN classes c ON tc.class_id = c.id
                 WHERE tc.teacher_id = :teacher_id"
            );
            $stmt->bindParam(':teacher_id', $this->id, PDO::PARAM_INT);
            $stmt->execute();
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Teacher GetClasses Error: " . $e->getMessage());
            return [];
        }
    }

    // Get subject-aware teaching assignments for dashboard views
    public function getTeachingAssignments() {
        try {
            $stmt = $this->conn->prepare(
                "SELECT DISTINCT
                        c.id,
                        c.name,
                        c.form_id,
                        f.name AS form_name,
                        s.id AS subject_id,
                        s.name AS subject_name
                 FROM teacher_assignment_requests r
                 JOIN classes c ON c.id = COALESCE(r.class_id, CASE WHEN r.assignment_type IN ('class', 'both') THEN r.target_id ELSE NULL END)
                 LEFT JOIN forms f ON f.id = c.form_id
                 LEFT JOIN subjects s ON s.id = COALESCE(r.subject_id, CASE WHEN r.assignment_type = 'subject' THEN r.target_id ELSE NULL END)
                 WHERE r.teacher_id = :teacher_id
                   AND r.status = 'approved'
                   AND r.academic_year_id = :academic_year_id
                   AND r.term_id = :term_id
                   AND COALESCE(r.class_id, CASE WHEN r.assignment_type IN ('class', 'both') THEN r.target_id ELSE NULL END) IS NOT NULL
                   AND COALESCE(r.subject_id, CASE WHEN r.assignment_type = 'subject' THEN r.target_id ELSE NULL END) IS NOT NULL
                 ORDER BY c.form_id ASC, c.name ASC, s.name ASC"
            );
            $stmt->bindParam(':teacher_id', $this->id, PDO::PARAM_INT);
            $stmt->bindParam(':academic_year_id', $this->academic_year_id, PDO::PARAM_INT);
            $stmt->bindParam(':term_id', $this->term_id, PDO::PARAM_INT);
            $stmt->execute();
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Teacher GetTeachingAssignments Error: " . $e->getMessage());
            return [];
        }
    }

    // Get subjects assigned to teacher
    public function getSubjects() {
        try {
            $stmt = $this->conn->prepare(
                "SELECT s.*
                 FROM teacher_subjects ts
                 JOIN subjects s ON ts.subject_id = s.id
                 WHERE ts.teacher_id = :teacher_id"
            );
            $stmt->bindParam(':teacher_id', $this->id, PDO::PARAM_INT);
            $stmt->execute();
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Teacher GetSubjects Error: " . $e->getMessage());
            return [];
        }
    }
}
