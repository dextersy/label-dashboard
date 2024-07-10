<?php
    require_once('./inc/model/eventreferrer.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/util/Mailer.php');

    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }

    $referrer = new EventReferrer;
    $referrer->fromFormPOST($_POST);
    $referrer->save();
    redirectTo("/events.php#referrers");
?>