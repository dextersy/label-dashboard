<?php
    require_once('./inc/model/earning.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/controller/earning-processor.php');

    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }

    $earning = new Earning;
    $earning->fromFormPOST($_POST);
    $earning->save();

    processNewEarning($earning, ($_POST['calculateRoyalties']=='1'));

    redirectTo("/financial.php#earning");
?>