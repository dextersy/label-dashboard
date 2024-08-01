<?
    require_once('./inc/util/Redirect.php');
    require_once('./inc/model/user.php');
    require_once('./inc/model/loginattempt.php');

    require_once('./inc/controller/check-login-lock.php');
    include_once('./inc/controller/brand_check.php');
    require_once('./inc/util/Mailer.php');

    function notifySuccessfulLogin($user, $proxy_ip, $remote_ip) {
		$subject = "Successful login to your account.";
		$emailAddresses[0] = $user->email_address;
        $body = "Hi " . $user->first_name . "!<br><br>";
        $body = $body. "We've detected a successful login from your account just now.<br>";
        $body = $body. "If this was you, you can safely ignore this notification.<br>";
        $body = $body. "If you didn't log in to your account, please notify your administrator or reply to this email.<br><br>";
        $body = $body. "Remote login IP: " . $remote_ip . "<br>";
        $body = $body. "Proxy login IP: " . $proxy_ip . "<br><br>";
 		return sendEmail($emailAddresses, $subject, $body);
	}

    function notifyAdminTooManyFailedLogins($user, $proxy_ip, $remote_ip) {
        $subject = "WARNING: Too many failed logins detected.";
		$emailAddresses[0] = "sy.dexter@gmail.com"; // TODO Maybe should be super admin or something...
        $body = $body. "We've detected multiple login failures for user <b>" . $user->username . "</b>.<br>";
        $body = $body. "Remote login IP: " . $remote_ip . "<br>";
        $body = $body. "Proxy login IP: " . $proxy_ip . "<br><br>";
 		return sendEmail($emailAddresses, $subject, $body);
    }   

    session_start();

    $proxy_ip = $_SERVER['HTTP_X_FORWARDED_FOR'];
    $remote_ip = $_SERVER['REMOTE_ADDR'];

    $user = new User;
    if(!$user->fromUsername($_SESSION['brand_id'], $_POST['login'])) {
        if (!$user->fromEmailAddress($_SESSION['brand_id'], $_POST['login']) ) {
            redirectTo("/index.php?err=no_user");
            die();
        }
    }

    // Check login lock
    if (checkLoginLock($user->id)) {
        notifyAdminTooManyFailedLogins($user, $proxy_ip, $remote_ip);
        redirectTo("/index.php?err=lock");
        die();
    }

    if ($user->password_md5 == md5($_POST['password'])) {
        $_SESSION['logged_in_user'] = $user->id;
        $_SESSION['logged_in_username'] = $user->username;

        $loginattempt = new LoginAttempt(
                                null, 
                                $user->id, 
                                "Successful", 
                                date("Y-m-d H:i:s"), 
                                $_SESSION['brand_id'], 
                                $proxy_ip, 
                                $remote_ip
                            );
        $loginattempt->save();
        notifySuccessfulLogin($user, $proxy_ip, $remote_ip);
        redirectTo("/dashboard.php");
    } else {
        $loginattempt = new LoginAttempt(
                                null, 
                                $user->id, 
                                "Failed", 
                                date("Y-m-d H:i:s"), 
                                $_SESSION['brand_id'], 
                                $proxy_ip, 
                                $remote_ip
                            );
        $loginattempt->save();
        
        redirectTo("/index.php?err=pass");
    }

?>