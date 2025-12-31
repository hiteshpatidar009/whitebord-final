<?php
require_once 'config.php';

if (!isset($_GET['id'])) {
    header("HTTP/1.0 404 Not Found");
    exit;
}

$id = intval($_GET['id']);

try {
    $stmt = $pdo->prepare("SELECT image_data FROM whiteboard_banners WHERE id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row) {
        // Attempt to detect mime type from data if possible, otherwise default
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->buffer($row['image_data']);
        header("Content-Type: " . $mimeType);
        echo $row['image_data'];
    } else {
        header("HTTP/1.0 404 Not Found");
    }
} catch (PDOException $e) {
    header("HTTP/1.0 500 Internal Server Error");
    echo "Error: " . $e->getMessage();
}
?>