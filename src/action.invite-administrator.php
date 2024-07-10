<?php
    require_once('./inc/config.php');
    require_once('./inc/model/user.php');
    require_once('./inc/model/artist.php');
    require_once('./inc/model/artistaccess.php');
    require_once('./inc/util/Redirect.php');
	require_once('./inc/util/Mailer.php');
	require_once('./inc/controller/access_check.php');
	require_once('./inc/controller/brand_check.php');

    $GLOBALS['debugOutput'] = [];

    function sendInviteEmail($emailAddress, $brandName, $inviteHash) {
		$subject = "You've been invited to join ". $brandName . " as a user.";
		$emailAddresses[0] = $emailAddress;
		return sendEmail($emailAddresses, $subject, generateEmailFromTemplate($artistName, $inviteHash));
	}

    function generateEmailFromTemplate($artistName, $inviteHash) {
		define ('TEMPLATE_LOCATION', 'assets/templates/invite_email.html', false);
		$file = fopen(TEMPLATE_LOCATION, 'r');
		$msg = fread($file, filesize(TEMPLATE_LOCATION));
		fclose($file);

        $msg = str_replace("%LOGO%", getProtocol() . $_SERVER['HTTP_HOST'] . "/" . $_SESSION['brand_logo'], $msg);
		$msg = str_replace('%ARTIST%', $artistName, $msg);
		$msg = str_replace('%LINK%', getProtocol() . $_SERVER['HTTP_HOST'] . "/setprofile.php?u=" . $inviteHash, $msg);
		
		return $msg;
	}

	$brand = new Brand;
	$brand->fromID($_SESSION['brand_id']);

	$result = sendInviteEmail($_POST['email_address'], $brand->name, $inviteHash);
	
	if($result) {
		$user = new User;
		if (!$user->fromEmailAddress($_SESSION['brand_id'], $_POST['email_address'])) { // means this is a new user
			$user->fromFormPOST($_POST);
			$user->save();
		}
		redirectTo('/admin.php?action=invite');
	}
	else {
		redirectTo('/admin.php?action=invite&status=email_failed');
	}

    
    
?>