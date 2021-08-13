<?php
    require_once('./inc/model/recuperableexpense.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/controller/access_check.php');

    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }

    $recuperableExpense = new RecuperableExpense;
    $recuperableExpense->fromFormPOST($_POST);
    $recuperableExpense->save();
    redirectTo("/financial.php#release");
?>