<?php
    session_start();
    $request_uri = $_SERVER['REQUEST_URI'];
    
    if (strpos($request_uri, "dashboard.php")) {
        $dashboard_active = true;
        $title_text = "Dashboard";
    }
    if (strpos($request_uri, "artist.php")) {
        $artist_active = true;
        $title_text = "Artist | " .  $_SESSION['current_artist_name'];
    }
    if (strpos($request_uri, "financial.php")) {
        $financial_active = true;
        $title_text = "Financial | " .  $_SESSION['current_artist_name'];
    }
    if (strpos($request_uri, "admin.php")) {
        $admin_active = true;
        $title_text = "Admin";
    }
    if (strpos($request_uri, "myprofile.php")) {
        $title_text = "Edit Your Profile";
    }
    if (strpos($request_uri, "newartist.php")) {
        $title_text = "New Artist";
    }

?>