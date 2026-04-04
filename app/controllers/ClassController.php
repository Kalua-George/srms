<?php
require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../models/SchoolClass.php';

class ClassController extends BaseController
{
    private function model(): SchoolClass
    {
        return new SchoolClass($this->userId(), $this->yearId(), $this->termId());
    }

    // GET /app/head/forms
    public function forms(): void
    {
        $this->requireRole(['head_teacher']);

        $m = $this->model();
        $this->json(['ok' => true, 'data' => $m->listForms()]);
    }

    // GET /app/head/classes
    public function classes(): void
    {
        $this->requireRole(['head_teacher']);

        $m = $this->model();
        $this->json(['ok' => true, 'data' => $m->listClasses()]);
    }

    // POST /app/head/classes/create
    public function create(): void
    {
        $this->requireRole(['head_teacher']);

        $data = $this->request();
        $name = trim((string)($data['name'] ?? ''));
        $formId = (int)($data['form_id'] ?? 0);

        if ($name === '' || $formId <= 0) {
            $this->json(['ok' => false, 'error' => 'name and form_id are required'], 400);
        }

        $m = $this->model();
        if ($m->createClass($name, $formId)) {
            $this->json(['ok' => true, 'id' => (int)$m->id]);
        }

        $this->json(['ok' => false, 'error' => 'Failed to create class'], 500);
    }
}