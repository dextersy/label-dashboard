<?php
    require_once('./inc/model/artist.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/controller/brand_check.php');
    require_once('./inc/util/Mailer.php');
    require_once('./inc/controller/get_team_members.php');
    require_once('./inc/util/FileUploader.php');
    require_once('./inc/controller/users-controller.php');


    function __sendNotification($artist) {
        $i = 0;
        
        $admins = getAllAdmins($_SESSION['brand_id']);
        if ($admins != null) {
            foreach($admins as $recipient) {
                $emailAddresses[$i++] = $recipient->email_address;
            }
        }
        $users = getActiveTeamMembersForArtist($artist->id);
        if ($users != null) {
            foreach ($users as $recipient) {
                $emailAddresses[$i++] = $recipient->email_address;
            }
        }
		$subject = "Payout point for ". $artist->name . " updated.";
        return sendEmail($emailAddresses, $subject, __generateEmailFromTemplate($artist->name, $artist->payout_point));
	}


    function __generateEmailFromTemplate($artistName, $payoutPoint) {
		define ('TEMPLATE_LOCATION', 'assets/templates/artist_update_payout_point.html', false);
		$file = fopen(TEMPLATE_LOCATION, 'r');
		$msg = fread($file, filesize(TEMPLATE_LOCATION));
		fclose($file);

        $msg = str_replace("%LOGO%", getProtocol() . $_SERVER['HTTP_HOST'] . "/" . $_SESSION['brand_logo'], $msg);
		$msg = str_replace('%ARTIST_NAME%', $artistName, $msg);
        $msg = str_replace('%PAYOUT_POINT%', $payoutPoint, $msg);
		$msg = str_replace('%LINK%', getProtocol() . $_SERVER['HTTP_HOST'], $msg);
		
		return $msg;
	}

    $result = false;
    $artist = new Artist;
    if ($artist->fromID($_POST['id'])) {
        $artist->payout_point = $_POST['payout_point'];
        $result = $artist->save();
        if ($result) {
            __sendNotification($artist);
        }
    }

    redirectTo("/financial.php?action=payoutPoint&status=" . ($result ? "OK" : "Failed"));
?>