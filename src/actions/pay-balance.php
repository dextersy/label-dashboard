<?php
    require_once('./inc/model/domain.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/controller/earning-processor.php');

    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }

    $domain = new Domain;
    $domain->fromFormPOST($_POST);
    if($domain->saveNew()) {
        redirectTo("/action.verify-domain.php?brand_id=" . $_POST['brand_id'] . "&domain_name=" . $_POST['domain_name']);
    }
    else {
        redirectTo("/admin.php?action=addDomain&status=Failed");
    }
?>