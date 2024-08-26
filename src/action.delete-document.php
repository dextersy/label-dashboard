<?php
    require_once('./inc/controller/access_check.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/controller/document-controller.php');

    if (!$isAdmin) {
        redirectTo('dashboard.php');
        die();
    }

    if (deleteDocument($_GET['id'])) {
        redirectTo("/financial.php?action=deleteDocument&status=OK");
    }
    else {
        redirectTo("/financial.php?action=deleteDocument&status=failed");
    }
?>