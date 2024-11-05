<?php
    require_once('./inc/model/payment.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/controller/payment-controller.php');

    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }

    $success = true;
    $payment = new Payment;
    if($_POST['payment_method_id'] == '-1') {
        unset($_POST['payment_method_id']);
    }
    $payment->fromFormPOST($_POST);

    $brand = new Brand;
    $brand->fromID($_SESSION['brand_id']);

    if($_POST['manualPayment'] != '1') {
        $success = makeAndSavePayment($payment, $brand);
    }
    else {
        $success = saveManualPayment($payment, $brand);
    }

    if($success) {
        redirectTo('/financial.php?action=addPayment&status=OK#payments');
    }
    else {
        redirectTo('/financial.php?action=addPayment&status=failed#payments');
    }
?>