<?php
    require_once('./inc/model/user.php');
    require_once('./inc/util/Redirect.php');

    $user = new User;
    $user->fromFormPOST($_POST);
    $user->save();

    $_SESSION['logged_in_username'] = $user->username;

    redirectTo('/index.php');
?>