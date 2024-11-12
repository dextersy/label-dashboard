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

    function sendInviteEmail($emailAddress, $artistName, $inviteHash, $brandName, $brandColor, $user) {
		$subject = "You've been invited to join ". $artistName . "'s team!";
		$emailAddresses[0] = $emailAddress;
		return sendEmail($emailAddresses, $subject, generateEmailFromTemplate($artistName, $inviteHash, $brandName, $brandColor, $user->first_name . " " . $user->last_name));
	}

    function generateEmailFromTemplate($artistName, $inviteHash, $brandName, $brandColor, $memberName) {
		define ('TEMPLATE_LOCATION', 'assets/templates/invite_email.html', false);
		$file = fopen(TEMPLATE_LOCATION, 'r');
		$msg = fread($file, filesize(TEMPLATE_LOCATION));
		fclose($file);

        $msg = str_replace("%LOGO%", $_SESSION['brand_logo'], $msg);
		$msg = str_replace('%ARTIST%', $artistName, $msg);
		$msg = str_replace('%BRAND_NAME%', $brandName, $msg);
		$msg = str_replace('%BRAND_COLOR%', $brandColor, $msg);
		$msg = str_replace('%MEMBER_NAME%', $memberName, $msg);
		$msg = str_replace('%URL%', getProtocol() . $_SERVER['HTTP_HOST'] . "/setprofile.php?u=" . $inviteHash, $msg);
		
		return $msg;
	}


	$artist = new Artist;
	if (!isset($_POST['invite_hash'])){
		$inviteHash = md5(time());
		$artist->fromID($_SESSION['current_artist']);
	}
	else {
		$inviteHash = $_POST['invite_hash'];
		$artistaccess = new ArtistAccess;
		$artistaccess->fromInviteHash($_POST['invite_hash']);
		$artist->fromID($artistaccess->artist_id);
	}

	$user = new User;
	$user->fromID($_SESSION['logged_in_user']);

	$result = sendInviteEmail($_POST['email_address'], $artist->name, $inviteHash, $_SESSION['brand_name'], $_SESSION['brand_color'], $user);
	
	if($result) {
		$user = new User;
		if (!$user->fromEmailAddress($_SESSION['brand_id'], $_POST['email_address'])) { // means this is a new user
			$user->fromFormPOST($_POST);
			$user->save();
		}
		if(!isset($_POST['invite_hash'])) {
			$artistaccess = new ArtistAccess($_SESSION['current_artist'], $user->id, true, true, true, "Pending", $inviteHash);
			$artistaccess->saveNew();
		}
		
		redirectTo('/artist.php?action=invite&status=OK#team');
	}
	else {
		redirectTo('/artist.php?action=invite&status=email_failed#team');
	}

    
    
?>