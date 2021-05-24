<?php
    $request_uri = $_SERVER['REQUEST_URI'];
    
    if (strpos($request_uri, "dashboard.php")) {
        $dashboard_active = true;
    }
    if (strpos($request_uri, "artist.php")) {
        $artist_active = true;
    }
    if (strpos($request_uri, "financial.php")) {
        $financial_active = true;
    }
?>