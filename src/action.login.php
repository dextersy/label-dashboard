<?
    require_once('./inc/util/Redirect.php');
    require_once('./inc/model/user.php');

    session_start();
    $user = new User;
    if(!$user->fromUsername($_POST['login'])) {
        if (!$user->fromEmailAddress($_POST['login']) ) {
            redirectTo("/index.php?err=no_user");
        }
    }

    if ($user->password_md5 == null || $user->password_md5 == '') {
        redirectTo("/setprofile.php?u=" . $user->invite_hash);
    }
    else if ($user->password_md5 == md5($_POST['password'])) {
        $_SESSION['logged_in_user'] = $user->id;
        $_SESSION['logged_in_username'] = $user->username;
        redirectTo("/dashboard.php");
    } else {
        redirectTo("/index.php?err=pass");
    }

?>