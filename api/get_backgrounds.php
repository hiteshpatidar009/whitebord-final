<?php
require_once 'config.php';

try {
    $stmt = $pdo->query("SELECT id, image_name FROM whiteboard_banners ORDER BY uploaded_at DESC");
    $backgrounds = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Determine base URL for the API
    // If this script is accessed via http://localhost/api/get_backgrounds.php, 
    // the view script is at http://localhost/api/view_background.php
    
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
    $host = $_SERVER['HTTP_HOST'];
    $scriptDir = dirname($_SERVER['PHP_SELF']);
    
    // Ensure scriptDir starts with / and doesn't end with /
    // Actually, just using relative path from the API root is safer for React proxies
    // But if the React app is on port 5173 and PHP on 80, we need full URL.
    // Since I don't know the exact setup, I'll return a path that assumes the React app knows the API base or proxies it.
    // However, usually in these setups, full URL is safest if CORS is allowed.
    
    $baseUrl = "$protocol://$host$scriptDir";

    $result = array_map(function($bg) use ($baseUrl) {
        return [
            'id' => $bg['id'],
            'name' => $bg['image_name'],
            'url' => "$baseUrl/view_background.php?id=" . $bg['id']
        ];
    }, $backgrounds);

    echo json_encode(['success' => true, 'data' => $result]);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>