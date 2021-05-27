<?php
    require_once('./inc/model/royalty.php');
    require_once('./inc/util/Redirect.php');

    $royalty = new Royalty;
    $royalty->fromFormPOST($_POST);
    $royalty->save();
    redirectTo("/financial.php#royalties");
?>