<?php
    require_once('./inc/model/artist.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/util/Mailer.php');
    require_once('./inc/controller/get_team_members.php');

    if(isset($_POST['id'])) {
        $artistOld = new Artist;
        $artistOld->fromID($_POST['id']);
    }
    $artist = new Artist;
    $artist->fromFormPOST($_POST);
    $artist->save();

    $_SESSION['current_artist'] = $artist->id;
    
    sendAdminNotification($artistOld, $artist);

    function sendAdminNotification($artistOld, $artist) {
        $admins = getAllAdmins();
        $i = 0;
        foreach($admins as $admin) {
            $emailAddresses[$i++] = $admin->email_address;
        }
		$subject = "Changes made to ". $artist->name . "'s profile!";

        $changeHistory = "(COMING SOON)"; // TODO Add actual change details

		return sendEmail($emailAddresses, $subject, generateEmailFromTemplate($artist->name, $changeHistory));
	}

    function generateEmailFromTemplate($artistName, $changeHistory) {
		define ('TEMPLATE_LOCATION', 'assets/templates/artist_update_email.html', false);
		$file = fopen(TEMPLATE_LOCATION, 'r');
		$msg = fread($file, filesize(TEMPLATE_LOCATION));
		fclose($file);

        $msg = str_replace("%LOGO%", getProtocol() . $_SERVER['HTTP_HOST'] . "/assets/img/logo-purple.png", $msg);
		$msg = str_replace('%ARTIST_NAME%', $artistName, $msg);
        $msg = str_replace('%CHANGED_ITEMS%', $changeHistory, $msg);
		$msg = str_replace('%LINK%', getProtocol() . $_SERVER['HTTP_HOST'], $msg);
		
		return $msg;
	}

    redirectTo("/artist.php?action=profile")
?>