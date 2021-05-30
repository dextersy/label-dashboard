<?php
    require_once('./inc/config.php');
    require_once('./inc/model/user.php');
    require_once('./inc/model/artist.php');
    require_once('./inc/model/artistaccess.php');
    require_once('./inc/util/Redirect.php');

    use PHPMailer\PHPMailer\PHPMailer;
	use PHPMailer\PHPMailer\Exception;

    // Load Composer's autoloader
	require 'vendor/autoload.php';

    session_start();

    $GLOBALS['debugOutput'] = [];

    function sendInviteEmail($emailAddress, $artistName, $inviteHash) {
		//PHPMailer Object
		$mail = new PHPMailer(true); //Argument true in constructor enables exceptions
		$mail->isSMTP();
		$mail->Host = SMTP_HOST;
		$mail->SMTPAuth = true;
		$mail->Username = SMTP_USER;
		$mail->Password = SMTP_PASS;
		$mail->Port = SMTP_PORT;

		//From email address and name
		$mail->From = "no-reply@melt-records.com";
		$mail->FromName = "Melt Records Artist Dashboard";

		//To address and name
		$mail->addAddress($emailAddress, "");

		//Address to which recipient will reply
		$mail->addReplyTo("hi@melt-records.com", "Reply");

		//Send HTML or Plain Text email
		$mail->isHTML(true);

		$mail->Subject = "You've been invited to join ". $artistName . "'s team!";
		$mail->Body = generateEmailFromTemplate($artistName, $inviteHash);
		$mail->AltBody = "This is the plain text version of the email content";

		try {
			$mail->send();
		} catch (Exception $e) {
			return false;
		}
		return true;
	}

    function generateEmailFromTemplate($artistName, $inviteHash) {
		define ('TEMPLATE_LOCATION', 'assets/templates/invite_email.html', false);
		$file = fopen(TEMPLATE_LOCATION, 'r');
		$msg = fread($file, filesize(TEMPLATE_LOCATION));
		fclose($file);

        $msg = str_replace("%LOGO%", "http://" . $_SERVER['HTTP_HOST'] . "/meltrecords/assets/img/logo-purple.png", $msg);
		$msg = str_replace('%ARTIST%', $artistName, $msg);
		$msg = str_replace('%LINK%', "http://" . $_SERVER['HTTP_HOST'] . "/meltrecords/setprofile.php?u=" . $inviteHash, $msg);
		
		return $msg;
	}

    $user = new User;
    if (!$user->fromEmailAddress($_POST['email_address'])) {
        $user->fromFormPOST($_POST);
        $user->save();
    }
    $user->fromEmailAddress($_POST['email_address']);

    $inviteHash = md5(time());
    $artistaccess = new ArtistAccess($_SESSION['current_artist'], $user->id, true, true, true, "Pending", $inviteHash);
    $artistaccess->saveNew();

    $artist = new Artist;
    $artist->fromID($artistaccess->artist_id);
    sendInviteEmail($user->email_address, $artist->name, $inviteHash);

    redirectTo('/artist.php?action=invite');
?>