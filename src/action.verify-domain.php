<?php
    require_once('./inc/model/domain.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/controller/earning-processor.php');

    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }

    $result = dns_get_record($_GET['domain_name'],DNS_A);
    $ip_server = $_SERVER['SERVER_ADDR'];

    if( $result[0]["ip"] == $ip_server ) {
        $domain = new Domain();
        $domain->fromID($_GET['brand_id'], $_GET['domain_name']);
        $domain->status = "Verified";
        $success = $domain->save();
    }
    else {
        $success = false;
    }

    redirectTo("/admin.php?action=VerifyDomain&status=" . ($success ? "OK": "Failed"));
?>