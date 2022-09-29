<?php
    require_once('./inc/model/paymentmethod.php');
    require_once('./inc/controller/access_check.php');

    $payment = new PaymentMethod;
    $payment->fromFormPOST($_POST);
    if($payment->save()) {
        redirectTo("/action.add-payment-method.php");
    }
    else {
        redirectTo("/financial.php?action=addPaymentMethod&status=Failed");
    }
?>