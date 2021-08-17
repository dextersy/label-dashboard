<?php
    require_once('./inc/config.php');
    require_once('./inc/model/user.php');
    require_once('./inc/model/artist.php');
    require_once('./inc/model/artistaccess.php');
    require_once('./inc/util/Redirect.php');
	require_once('./inc/util/Mailer.php');
	require_once('./inc/controller/access_check.php');

    $GLOBALS['debugOutput'] = [];

    function sendInviteEmail($emailAddress, $artistName, $inviteHash) {
		$subject = "You've been invited to join ". $artistName . "'s team!";
		$emailAddresses[0] = $emailAddress;
		return sendEmail($emailAddresses, $subject, generateEmailFromTemplate($artistName, $inviteHash));
	}

    function generateEmailFromTemplate($artistName, $inviteHash) {
		define ('TEMPLATE_LOCATION', 'assets/templates/invite_email.html', false);
		$file = fopen(TEMPLATE_LOCATION, 'r');
		$msg = fread($file, filesize(TEMPLATE_LOCATION));
		fclose($file);

        $msg = str_replace("%LOGO%", getProtocol() . $_SERVER['HTTP_HOST'] . "/assets/img/logo-purple.png", $msg);
		$msg = str_replace('%ARTIST%', $artistName, $msg);
		$msg = str_replace('%LINK%', getProtocol() . $_SERVER['HTTP_HOST'] . "/setprofile.php?u=" . $inviteHash, $msg);
		
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
	$artist->fromID($artistaccess->artist_id);

	$result = sendInviteEmail($_POST['email_address'], $artist->name, $inviteHash);
	
	if($result) {
		$user = new User;
		if (!$user->fromEmailAddress($_POST['email_address'])) { // means this is a new user
			$user->fromFormPOST($_POST);
			$user->save();
		}
		if(!isset($_POST['invite_hash'])) {
			$artistaccess = new ArtistAccess($_SESSION['current_artist'], $user->id, true, true, true, "Pending", $inviteHash);
			$artistaccess->saveNew();
		}
		
		redirectTo('/artist.php?action=invite');
	}
	else {
		redirectTo('/artist.php?action=invite&status=email_failed');
	}

    
    
?>