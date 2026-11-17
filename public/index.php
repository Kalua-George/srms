<?php

declare(strict_types=1);

session_start();

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$base = '/srms/public';
if (str_starts_with($path, $base)) {
    $path = substr($path, strlen($base));
    if ($path === '') $path = '/';
}

// If root request, show login page instead of API
if ($path === '/') {
    header('Location: login.html');
    exit;
}

require_once __DIR__ . '/../routes/routes.php';
dispatch($ROUTES);