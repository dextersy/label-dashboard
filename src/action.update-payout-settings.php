<?php
    require_once('./inc/model/artist.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/controller/brand_check.php');
    require_once('./inc/util/Mailer.php');
    require_once('./inc/controller/get_team_members.php');
    require_once('./inc/util/FileUploader.php');
    require_once('./inc/controller/users-controller.php');


    function __sendNotification($artist, $brandName, $brandColor, $user) {
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
        return sendEmail($emailAddresses, $subject, __generateEmailFromTemplate($artist->name, $artist->payout_point, $brandName, $brandColor, $user->first_name . ' ' . $user->last_name));
	}


    function __generateEmailFromTemplate($artistName, $payoutPoint, $brandName, $brandColor, $memberName) {
		define ('TEMPLATE_LOCATION', 'assets/templates/artist_update_payout_point.html', false);
		$file = fopen(TEMPLATE_LOCATION, 'r');
		$msg = fread($file, filesize(TEMPLATE_LOCATION));
		fclose($file);

        $msg = str_replace("%LOGO%", getProtocol() . $_SERVER['HTTP_HOST'] . "/" . $_SESSION['brand_logo'], $msg);
		$msg = str_replace('%ARTIST_NAME%', $artistName, $msg);
        $msg = str_replace('%PAYOUT_POINT%', '₱ ' . number_format($payoutPoint, 2, '.', ','), $msg);
        $msg = str_replace('%BRAND_NAME%', $brandName, $msg);
        $msg = str_replace('%BRAND_COLOR%', $brandColor, $msg);
        $msg = str_replace('%MEMBER_NAME%', $memberName, $msg);
		$msg = str_replace('%URL%', getProtocol() . $_SERVER['HTTP_HOST'] . "/financial.php#payments", $msg);
		
		return $msg;
	}

    $result = false;
    $artist = new Artist;
    if ($artist->fromID($_POST['id'])) {
        $payoutPointUpdated = false;
        $paymentHoldUpdated = false;

        if($artist->payout_point != $_POST['payout_point']) {
            $artist->payout_point = $_POST['payout_point'];
            $payoutPointUpdated = true;
        }

        if(!isset($_POST['hold_payouts'])) { $_POST['hold_payouts'] = '0'; }
        if($artist->hold_payouts != $_POST['hold_payouts']) {
            $artist->hold_payouts = $_POST['hold_payouts'];
            $paymentHoldUpdated = true;
        }

        $result = $artist->save();

        // Get user details for audit trail
        $user = new User;
        $user->fromID($_SESSION['logged_in_user']);

        if ($result && $payoutPointUpdated) {
            __sendNotification($artist, $_SESSION['brand_name'], $_SESSION['brand_color'], $user);
        }
    }

    redirectTo("/financial.php?action=payoutPoint&status=" . ($result ? "OK" : "Failed") . "#payments");
?>