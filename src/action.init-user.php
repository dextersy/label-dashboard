<?php
    require_once('./inc/model/artistaccess.php');
    require_once('./inc/model/user.php');
    require_once('./inc/util/Redirect.php');

    $user = new User;
    $user->fromFormPOST($_POST);
    $user->save();

    session_start();
    $_SESSION['logged_in_user'] = $user->id;
    $_SESSION['logged_in_username'] = $user->username;

    if ($_POST['invite_hash']) {
        $artistAccess = new ArtistAccess;
        $artistAccess->fromInviteHash($_POST['invite_hash']);
        $artistAccess->status = "Accepted";
        $artistAccess->invite_hash = "";
        $artistAccess->saveUpdates();
    }

    redirectTo('/index.php');
?>