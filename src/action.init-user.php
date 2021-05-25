<?php
    require_once('./inc/model/user.php');
    require_once('./inc/util/Redirect.php');

    $user = new User;
    $user->fromFormPOST($_POST);
    $user->save();

    redirectTo('/index.php');
?>