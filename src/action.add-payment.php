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

    $success = true;
    $payment = new Payment;
    $payment->fromFormPOST($_POST);
    echo "Payment method id = " . $payment->payment_method_id;

    if (isset($payment->payment_method_id) && $payment->payment_method_id != '' && $_POST['manualPayment'] == '1') {
        // Pay through Paymongo
        $success = sendPaymentThroughPaymongo($payment->payment_method_id, $payment->amount, $payment->description);
    }
    if($success) {
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
            __sendPaymentNotification(
                $emailAddresses, 
                $artist->name, 
                $payment
            );
        }
    }

    function __sendPaymentNotification($emailAddresses, $artistName, $payment) {
		$subject = "Payment made to ". $artistName . "!";
		return sendEmail($emailAddresses, $subject, __generateEmailFromTemplate($artistName, $payment));
	}

    function __generateEmailFromTemplate($artistName, $payment) {
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