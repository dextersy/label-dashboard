<?php
    require_once('./inc/model/payment.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/controller/get_team_members.php');
    require_once('./inc/util/Mailer.php');

    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }

    $payment = new Payment;
    $payment->fromFormPOST($_POST);
    if (isset($_POST['paid_thru'])) {
        $haystack = $_POST['paid_thru'];
        
        $payment->paid_thru_type = substr($haystack, 0, strpos($haystack, "-") - 1);
        $haystack = substr($haystack, strpos($haystack, "-") + 1);

        $payment->paid_thru_account_name = substr($haystack, 0, strpos($haystack, "-") - 1);
        $haystack = substr($haystack, strpos($haystack, "-") + 1);

        $payment->paid_thru_account_number = $haystack;
    }
    $payment->save();
    
    $GLOBALS['debugOutput'] = [];
    
    // Send email notification
    $artist = new Artist;
    $artist->fromID($payment->artist_id);
    $users = getActiveTeamMembersForArtist($artist->id);
    $i = 0;
    foreach ($users as $user) {
        $emailAddresses[$i++] = $user->email_address;
    }
    if ($i > 0) {
        sendPaymentNotification(
            $emailAddresses, 
            $artist->name, 
            $payment
        );
    }

    function sendPaymentNotification($emailAddresses, $artistName, $payment) {
		$subject = "Payment made to ". $artistName . "!";
		return sendEmail($emailAddresses, $subject, generateEmailFromTemplate($artistName, $payment));
	}

    function generateEmailFromTemplate($artistName, $payment) {
		define ('TEMPLATE_LOCATION', 'assets/templates/payment_notification_email.html', false);
		$file = fopen(TEMPLATE_LOCATION, 'r');
		$msg = fread($file, filesize(TEMPLATE_LOCATION));
		fclose($file);

        $msg = str_replace("%LOGO%", getProtocol() . $_SERVER['HTTP_HOST'] . "/" . $_SESSION['brand_logo'], $msg);
		$msg = str_replace('%ARTIST%', $artistName, $msg);
        $msg = str_replace('%AMOUNT%', "Php " . number_format($payment->amount, 2), $msg);
        $msg = str_replace('%DESCRIPTION%', $payment->description, $msg);
		$msg = str_replace('%URL%', getProtocol() . $_SERVER['HTTP_HOST'], $msg);
		
		return $msg;
	}

    redirectTo('/financial.php#payments');
?>