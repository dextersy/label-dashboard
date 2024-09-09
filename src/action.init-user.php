<?php
    require_once('./inc/model/artistaccess.php');
    require_once('./inc/model/user.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/model/loginattempt.php');
    
    if (!$_POST['invite_hash'] && !$_POST['reset_hash']) {
        require_once('./inc/controller/access_check.php');
    }
    else if($_POST['invite_hash']){
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
    else if($_POST['password'] != '' && $_POST['validation'] != '') { //assume from reset password
        if ($_POST['password'] != $_POST['validation']) {
            redirectTo('/resetpassword.php?err=mismatch&code=' . $user->reset_hash);
            die();
        }
        else {
            $user->password_md5 = md5($_POST['password']);
        }
    }
    
    unset($user->reset_hash);
    $user->save();

    if(!$_POST['validation']) {     // THIS IS UGLY - but for now, this is the only way to check if this is NOT a reset password request
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
    }

    if ($_POST['origin'] == 'myprofile') {
        redirectTo('/myprofile.php?err=0');
    }
    else {
        redirectTo('/index.php?resetpass=1');
    }
?>