<?php
    session_start();
    $request_uri = $_SERVER['REQUEST_URI'];
    
    if (strpos($request_uri, "dashboard.php")) {
        $dashboard_active = true;
        $title_icon = "pe-7s-graph";
        $title_text = "Dashboard";
    }
    if (strpos($request_uri, "artist.php")) {
        $artist_active = true;
        $title_icon = "pe-7s-headphones";
        $title_text = "Artist";
    }
    if (strpos($request_uri, "financial.php")) {
        $financial_active = true;
        $title_icon = "pe-7s-note2";
        $title_text = "Financial";
    }
    if (strpos($request_uri, "admin.php")) {
        $admin_active = true;
        $title_icon = "pe-7s-lock";
        $title_text = "Admin";
    }
    if (strpos($request_uri, "myprofile.php")) {
        $title_text = "Edit Your Profile";
    }
    if (strpos($request_uri, "newartist.php")) {
        $title_text = "New Artist";
    }

?>