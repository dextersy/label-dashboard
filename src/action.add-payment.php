<?php
    require_once('./inc/model/payment.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/controller/get_team_members.php');
    require_once('./inc/controller/payment-controller.php');
    require_once('./inc/util/Mailer.php');

    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }

    $success = true;
    $payment = new Payment;
    $payment->fromFormPOST($_POST);

    if (isset($payment->payment_method_id) && $payment->payment_method_id != '' && $_POST['manualPayment'] != '1') {
        // Pay through Paymongo
        $brand = new Brand;
        $brand->fromID($_SESSION['brand_id']);
        $processing_fee = $brand->payment_processing_fee_for_payouts;
        $referenceNumber = sendPaymentThroughPaymongo($_SESSION['brand_id'], $payment->payment_method_id, $payment->amount - $processing_fee, $payment->description);
        if($referenceNumber != null) {
            $payment->payment_processing_fee = $processing_fee;
            $payment->reference_number = $referenceNumber;
            $success = true;
        }
        else {
            $success = false;
        }
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
                $payment,
                $_SESSION['brand_name'],
                $_SESSION['brand_color']
            );
        }
        redirectTo('/financial.php?action=addPayment&status=OK#payments');
    }
    else {
        redirectTo('/financial.php?action=addPayment&status=failed#payments');
    }

    /// HELPER FUNCTIONS BELOW
    function __sendPaymentNotification($emailAddresses, $artistName, $payment, $brandName, $brandColor) {
		$subject = "Payment made to ". $artistName . "!";
		return sendEmail($emailAddresses, $subject, __generateEmailFromTemplate($artistName, $payment, $brandName, $brandColor));
	}

    function __generateEmailFromTemplate($artistName, $payment, $brandName, $brandColor) {
		define ('TEMPLATE_LOCATION', 'assets/templates/payment_notification_email.html', false);
		$file = fopen(TEMPLATE_LOCATION, 'r');
		$msg = fread($file, filesize(TEMPLATE_LOCATION));
		fclose($file);

        $msg = str_replace("%LOGO%", getProtocol() . $_SERVER['HTTP_HOST'] . "/" . $_SESSION['brand_logo'], $msg);
        $msg = str_replace("%BRAND_NAME%", $brandName, $msg);
        $msg = str_replace("%BRAND_COLOR%", $brandColor, $msg);
		$msg = str_replace('%ARTIST%', $artistName, $msg);
        $msg = str_replace('%AMOUNT%', "₱ " . number_format($payment->amount, 2), $msg);
        $msg = str_replace('%PROCESSING_FEE%', "₱ " . number_format($payment->payment_processing_fee, 2), $msg);
        $msg = str_replace('%NET_AMOUNT%', "₱ " . number_format($payment->amount - $payment->payment_processing_fee, 2), $msg);
        $msg = str_replace('%DESCRIPTION%', $payment->description, $msg);
		$msg = str_replace('%URL%', getProtocol() . $_SERVER['HTTP_HOST'] . "/financial.php#payments", $msg);
		
		return $msg;
	}

?>