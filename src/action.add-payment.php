<?php
    require_once('./inc/model/payment.php');
    require_once('./inc/util/Redirect.php');

    $payment = new Payment;
    $payment->fromFormPOST($_POST);
    $payment->save();
    redirectTo("/financial.php#payments");
?>