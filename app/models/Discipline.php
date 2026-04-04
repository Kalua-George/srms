<?php
require_once __DIR__ . '/BaseModel.php';

class Discipline extends BaseModel {
    private $table = 'disciplinary_records';

    public $id;
    public $student_id;
    public $type_id;
    public $action_id;
    public $reported_by;
    public $incident_date;
    public $description;
    public $follow_up;

    public function __construct($user_id = null, $academic_year_id = null, $term_id = null) {
        parent::__construct($user_id, $academic_year_id, $term_id);
    }

    private function validate() {
        if (empty($this->student_id) || empty($this->type_id) || empty($this->reported_by) || empty($this->incident_date)) {
            throw new Exception("student_id, type_id, reported_by, and incident_date are required.");
        }
    }

    public function create() {
        try {
            $this->validate();

            $query = "INSERT INTO {$this->table}
                      (student_id, type_id, action_id, reported_by, incident_date, description, follow_up)
                      VALUES
                      (:student_id, :type_id, :action_id, :reported_by, :incident_date, :description, :follow_up)";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':student_id', $this->student_id, PDO::PARAM_INT);
            $stmt->bindParam(':type_id', $this->type_id, PDO::PARAM_INT);
            $stmt->bindParam(':action_id', $this->action_id);
            $stmt->bindParam(':reported_by', $this->reported_by, PDO::PARAM_INT);
            $stmt->bindParam(':incident_date', $this->incident_date);
            $stmt->bindParam(':description', $this->description);
            $stmt->bindParam(':follow_up', $this->follow_up);

            if ($stmt->execute()) {
                $this->id = (int)$this->conn->lastInsertId();
                $this->logAction("Create Discipline Case", "Case ID {$this->id} for student {$this->student_id}");
                return true;
            }
            return false;

        } catch (Exception $e) {
            error_log("Discipline create() Error: " . $e->getMessage());
            return false;
        } catch (PDOException $e) {
            error_log("Discipline create() DB Error: " . $e->getMessage());
            return false;
        }
    }

    public function update() {
        try {
            if (empty($this->id)) throw new Exception("Discipline case id is required for update.");
            $this->validate();

            $query = "UPDATE {$this->table} SET
                        student_id = :student_id,
                        type_id = :type_id,
                        action_id = :action_id,
                        reported_by = :reported_by,
                        incident_date = :incident_date,
                        description = :description,
                        follow_up = :follow_up
                      WHERE id = :id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':student_id', $this->student_id, PDO::PARAM_INT);
            $stmt->bindParam(':type_id', $this->type_id, PDO::PARAM_INT);
            $stmt->bindParam(':action_id', $this->action_id);
            $stmt->bindParam(':reported_by', $this->reported_by, PDO::PARAM_INT);
            $stmt->bindParam(':incident_date', $this->incident_date);
            $stmt->bindParam(':description', $this->description);
            $stmt->bindParam(':follow_up', $this->follow_up);
            $stmt->bindParam(':id', $this->id, PDO::PARAM_INT);

            if ($stmt->execute()) {
                $this->logAction("Update Discipline Case", "Case ID {$this->id} updated");
                return true;
            }
            return false;

        } catch (Exception $e) {
            error_log("Discipline update() Error: " . $e->getMessage());
            return false;
        } catch (PDOException $e) {
            error_log("Discipline update() DB Error: " . $e->getMessage());
            return false;
        }
    }

    public function delete() {
        try {
            if (empty($this->id)) throw new Exception("Discipline case id is required for delete.");

            $query = "DELETE FROM {$this->table} WHERE id = :id";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $this->id, PDO::PARAM_INT);

            if ($stmt->execute()) {
                $this->logAction("Delete Discipline Case", "Case ID {$this->id} deleted");
                return true;
            }
            return false;

        } catch (Exception $e) {
            error_log("Discipline delete() Error: " . $e->getMessage());
            return false;
        } catch (PDOException $e) {
            error_log("Discipline delete() DB Error: " . $e->getMessage());
            return false;
        }
    }

    public function getById($id) {
        try {
            $query = "SELECT dr.*,
                             dt.name AS type_name,
                             da.action_name,
                             st.fname,
                             st.lname,
                             t.firstname AS reporter_fname,
                             t.lastname AS reporter_lname
                      FROM {$this->table} dr
                      JOIN students st ON dr.student_id = st.id
                      JOIN disciplinary_types dt ON dr.type_id = dt.id
                      LEFT JOIN disciplinary_actions da ON dr.action_id = da.id
                      JOIN teachers t ON dr.reported_by = t.id
                      WHERE dr.id = :id
                      LIMIT 1";
            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            return $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("Discipline getById() Error: " . $e->getMessage());
            return null;
        }
    }

    public function getByStudent($student_id) {
        try {
            $query = "SELECT dr.*,
                             dt.name AS type_name,
                             da.action_name,
                             t.firstname AS reporter_fname,
                             t.lastname AS reporter_lname
                      FROM {$this->table} dr
                      JOIN disciplinary_types dt ON dr.type_id = dt.id
                      LEFT JOIN disciplinary_actions da ON dr.action_id = da.id
                      JOIN teachers t ON dr.reported_by = t.id
                      WHERE dr.student_id = :student_id
                      ORDER BY dr.incident_date DESC, dr.id DESC";

            $stmt = $this->conn->prepare($query);
            $stmt->bindParam(':student_id', $student_id, PDO::PARAM_INT);
            $stmt->execute();
            return $stmt->fetchAll(PDO::FETCH_ASSOC);

        } catch (PDOException $e) {
            error_log("Discipline getByStudent() Error: " . $e->getMessage());
            return [];
        }
    }
}
