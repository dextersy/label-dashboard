<?php
    require_once('./inc/model/artistaccess.php');
    require_once('./inc/model/user.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/model/loginattempt.php');
    
    if (!$_POST['invite_hash']) {
        require_once('./inc/controller/access_check.php');
    }
    else {
        $artistAccess = new ArtistAccess;
        $artistAccess->fromInviteHash($_POST['invite_hash']);
        if(!isset($artistAccess->artist_id)) {
            redirectTo('/index.php?err=invalid_hash');
        }
    }

    
    $user = new User;
    $user->fromFormPOST($_POST);
    if ($_POST['origin'] == 'myprofile' && $_POST['new_password'] && $_POST['new_password'] != '') { 
        if (md5($_POST['old_password']) == $user->password_md5) {
            if ($_POST['new_password'] == $_POST['confirm_password']) {
                $user->password_md5 = md5($_POST['new_password']);
            }
            else {
                redirectTo('/myprofile.php?err=mismatch');
                die();
            }
        }
        else {
            redirectTo('/myprofile.php?err=wrong_password');
            die();
        }
    }
    unset($user->reset_hash);
    $user->save();

    session_start();
    $_SESSION['logged_in_user'] = $user->id;
    $_SESSION['logged_in_username'] = $user->username;

    $loginattempt = new LoginAttempt(null, $user->id, "Successful", date("Y-m-d H:i:s"), $_SESSION['brand_id']);
    $loginattempt->save();    

    if ($_POST['invite_hash']) {
        $artistAccess = new ArtistAccess;
        $artistAccess->fromInviteHash($_POST['invite_hash']);
        $artistAccess->status = "Accepted";
        $artistAccess->invite_hash = "";
        $artistAccess->saveUpdates();
    }

    if ($_POST['origin'] == 'myprofile') {
        redirectTo('/myprofile.php?err=0');
    }
    else {
        redirectTo('/index.php');
    }
?>