<?php
    require_once('./inc/model/royalty.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/controller/access_check.php');

    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }

    $royalty = new Royalty;
    $royalty->fromFormPOST($_POST);
    $royalty->save();
    redirectTo("/financial.php#royalties");
?>