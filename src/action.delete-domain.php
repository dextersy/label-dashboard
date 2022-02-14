<?php
    require_once('./inc/model/domain.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/controller/earning-processor.php');

    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }

    if (Domain::deleteDomain($_GET['brand_id'], $_GET['domain_name'])) {
        redirectTo("/admin.php?action=deleteDomain&status=OK");
    }
    else {
        redirectTo("/admin.php?action=deleteDomain&status=failed");
    }
?>