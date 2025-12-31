<?php
require_once 'config.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
    exit;
}

if (!isset($_FILES['image'])) {
    echo json_encode(['success' => false, 'message' => 'No file uploaded']);
    exit;
}

$file = $_FILES['image'];
$fileName = $file['name'];
$fileTmpName = $file['tmp_name'];
$fileError = $file['error'];

if ($fileError === 0) {
    // Limit file size if needed (e.g. 5MB)
    if ($file['size'] > 5000000) {
        echo json_encode(['success' => false, 'message' => 'File too large']);
        exit;
    }

    $imageData = file_get_contents($fileTmpName);
    
    try {
        $stmt = $pdo->prepare("INSERT INTO whiteboard_banners (image_name, image_data) VALUES (?, ?)");
        $stmt->execute([$fileName, $imageData]);
        
        echo json_encode(['success' => true, 'message' => 'Image uploaded successfully']);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'File upload error']);
}
?>