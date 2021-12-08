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

	$result = sendResetLink($user->email_address, $resetHash);
	
	if($result) {
		redirectTo('/forgotpassword.php?err=sent');
	} else {
		redirectTo('/forgotpassword.php?err=unknown');
	}
    
    function sendResetLink($emailAddress, $resetHash) {
		$subject = "Here's the link to reset your password.";
		$emailAddresses[0] = $emailAddress;
		return sendEmail($emailAddresses, $subject, generateEmailFromTemplate($artistName, $resetHash));
	}

    function generateEmailFromTemplate($artistName, $resetHash) {
		define ('TEMPLATE_LOCATION', 'assets/templates/reset_password_email.html', false);
		$file = fopen(TEMPLATE_LOCATION, 'r');
		$msg = fread($file, filesize(TEMPLATE_LOCATION));
		fclose($file);

        $msg = str_replace("%LOGO%", getProtocol() . $_SERVER['HTTP_HOST'] . "/" . $_SESSION['brand_logo'], $msg);
		$msg = str_replace('%LINK%', getProtocol() . $_SERVER['HTTP_HOST'] . "/resetpassword.php?code=" . $resetHash, $msg);
		
		return $msg;
	}
?>