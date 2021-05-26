<?php
    require_once('./inc/model/user.php');
    require_once('./inc/model/artistaccess.php');
    require_once('./inc/util/Redirect.php');

    session_start();

    $user = new User;
    if (!$user->fromEmailAddress($_POST['email_address'])) {
        $user->fromFormPOST($_POST);
        $user->save();
    }
    $user->fromEmailAddress($_POST['email_address']);

    $inviteHash = md5(time());
    $artistaccess = new ArtistAccess($_SESSION['current_artist'], $user->id, true, true, true, "Pending", $inviteHash);
    $artistaccess->saveNew();

    // TODO send email

    redirectTo('/artist.php#team');
?>