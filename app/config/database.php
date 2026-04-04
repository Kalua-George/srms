<?php
// config/database.php

class Database {
    private $host;       // Database host
    private $db_name;    // Database name
    private $username;   // DB username
    private $password;   // DB password
    public $conn;

    public function __construct() {
        $this->host = getenv('DB_HOST') ?: "localhost";
        $this->db_name = getenv('DB_NAME') ?: "school_data";
        $this->username = getenv('DB_USERNAME') ?: (getenv('DB_USER') ?: "root");
        $this->password = getenv('DB_PASSWORD') ?: (getenv('DB_PASS') ?: "");
    }

    // Get the PDO database connection
    public function getConnection() {
        $this->conn = null;

        try {
            $dsn = "mysql:host={$this->host};dbname={$this->db_name};charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,  // Throw exceptions on errors
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, // Fetch associative arrays
                PDO::ATTR_EMULATE_PREPARES => false, // Use native prepared statements
            ];
            $this->conn = new PDO($dsn, $this->username, $this->password, $options);
        } catch(PDOException $exception) {
            die("Database connection error: " . $exception->getMessage());
        }

        return $this->conn;
    }
}
