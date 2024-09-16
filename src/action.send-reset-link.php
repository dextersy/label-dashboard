<?php
    require_once('./inc/config.php');
    require_once('./inc/model/user.php');
    require_once('./inc/util/Redirect.php');
	require_once('./inc/util/Mailer.php');
	require_once('./inc/controller/brand_check.php');

    $GLOBALS['debugOutput'] = [];
	$user = new User;
	if (!$user->fromEmailAddress($_SESSION['brand_id'], $_POST['email_address'])) {
		redirectTo("/forgotpassword.php?err=no_user");
	}
	$resetHash = md5(time());
	$user->reset_hash = $resetHash;
	$user->save();

	$result = sendResetLink($user->email_address, $resetHash, $_SESSION['brand_name'], $_SESSION['brand_color']);

	$proxy_ip = $_SERVER['HTTP_X_FORWARDED_FOR'];
    $remote_ip = $_SERVER['REMOTE_ADDR'];
	sendAdminNotification($user, $remote_ip, $proxy_ip);
	
	if($result) {
		redirectTo('/forgotpassword.php?err=sent');
	} else {
		redirectTo('/forgotpassword.php?err=unknown');
	}
    
    function sendResetLink($emailAddress, $resetHash, $brandName, $brandColor) {
		$subject = "Here's the link to reset your password!";
		$emailAddresses[0] = $emailAddress;
		return sendEmail($emailAddresses, $subject, generateEmailFromTemplate($resetHash, $brandName, $brandColor));
	}

    function generateEmailFromTemplate($resetHash, $brandName, $brandColor) {
		define ('TEMPLATE_LOCATION', 'assets/templates/reset_password_email.html', false);
		$file = fopen(TEMPLATE_LOCATION, 'r');
		$msg = fread($file, filesize(TEMPLATE_LOCATION));
		fclose($file);

        $msg = str_replace("%LOGO%", getProtocol() . $_SERVER['HTTP_HOST'] . "/" . $_SESSION['brand_logo'], $msg);
		$msg = str_replace('%URL%', getProtocol() . $_SERVER['HTTP_HOST'] . "/resetpassword.php?code=" . $resetHash, $msg);
		$msg = str_replace('%BRAND_NAME%', $brandName, $msg);
		$msg = str_replace('%BRAND_COLOR%', $brandColor, $msg);
		
		return $msg;
	}

	function sendAdminNotification($user, $remote_ip, $proxy_ip) {
		$subject = "Password reset requested for user " . $user->username;
		$emailAddresses[0] = "sy.dexter@gmail.com"; // TODO Maybe should be super admin or something...
        $body = "We've detected a password reset request for user <b>" . $user->username . "</b>.<br>";
        $body = $body. "Remote login IP: " . $remote_ip . "<br>";
        $body = $body. "Proxy login IP: " . $proxy_ip . "<br><br>";
 		return sendEmail($emailAddresses, $subject, $body);
	}
?>