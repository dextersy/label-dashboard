<?
    require_once('./inc/util/Redirect.php');
    require_once('./inc/model/user.php');
    require_once('./inc/model/loginattempt.php');

    require_once('./inc/controller/check-login-lock.php');
    include_once('./inc/controller/brand_check.php');

    session_start();
    $user = new User;
    if(!$user->fromUsername($_SESSION['brand_id'], $_POST['login'])) {
        if (!$user->fromEmailAddress($_SESSION['brand_id'], $_POST['login']) ) {
            redirectTo("/index.php?err=no_user");
            die();
        }
    }

    // Check login lock
    if (checkLoginLock($user->id)) {
        redirectTo("/index.php?err=lock");
        die();
    }

    if ($user->password_md5 == md5($_POST['password'])) {
        $_SESSION['logged_in_user'] = $user->id;
        $_SESSION['logged_in_username'] = $user->username;

        //$user->last_logged_in = date("Y-m-d H:i:s");
        //$user->save();

        $loginattempt = new LoginAttempt(null, $user->id, "Successful", date("Y-m-d H:i:s"), $_SESSION['brand_id']);
        $loginattempt->save();

        redirectTo("/dashboard.php");
    } else {

        $loginattempt = new LoginAttempt(null, $user->id, "Failed", date("Y-m-d H:i:s"), $_SESSION['brand_id']);
        $loginattempt->save();
        
        redirectTo("/index.php?err=pass");
    }

?>