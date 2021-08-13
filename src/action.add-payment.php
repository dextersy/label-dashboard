<?php
    require_once('./inc/model/payment.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/controller/access_check.php');

    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }

    $payment = new Payment;
    $payment->fromFormPOST($_POST);
    $payment->save();
    redirectTo("/financial.php#payments");
?>