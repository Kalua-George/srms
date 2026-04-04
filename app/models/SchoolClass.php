<?php
require_once __DIR__ . '/BaseModel.php';

class SchoolClass extends BaseModel
{
    private $table = 'classes';

    public $id;
    public $name;
    public $form_id;

    public function __construct($user_id = null, $academic_year_id = null, $term_id = null)
    {
        parent::__construct($user_id, $academic_year_id, $term_id);
    }

    public function listForms(): array
    {
        try {
            $stmt = $this->conn->prepare("SELECT id, name FROM forms ORDER BY id ASC");
            $stmt->execute();
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("SchoolClass ListForms Error: " . $e->getMessage());
            return [];
        }
    }

    public function listClasses(): array
    {
        try {
            $stmt = $this->conn->prepare(
                "SELECT c.*, f.name AS form_name
                 FROM {$this->table} c
                 JOIN forms f ON f.id = c.form_id
                 ORDER BY c.form_id ASC, c.name ASC"
            );
            $stmt->execute();
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            error_log("SchoolClass ListClasses Error: " . $e->getMessage());
            return [];
        }
    }

    public function createClass(string $name, int $form_id): bool
    {
        $name = trim($name);
        if ($name === '' || $form_id <= 0) {
            return false;
        }

        try {
            $stmt = $this->conn->prepare(
                "INSERT INTO {$this->table} (academic_year_id, term_id, name, form_id)
                 VALUES (:year, :term, :name, :form_id)"
            );

            $ok = $stmt->execute([
                ':year' => $this->academic_year_id,
                ':term' => $this->term_id,
                ':name' => $name,
                ':form_id' => $form_id,
            ]);

            if ($ok) {
                $this->id = (int)$this->conn->lastInsertId();
                $this->logAction('Create Class', "Created class {$name} (form_id={$form_id})");
                return true;
            }
        } catch (PDOException $e) {
            error_log("SchoolClass CreateClass Error: " . $e->getMessage());
        }

        return false;
    }
}