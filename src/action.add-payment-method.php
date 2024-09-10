<?php
    require_once('./inc/controller/brand_check.php');
    require_once('./inc/model/paymentmethod.php');
    require_once('./inc/model/artist.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/util/Mailer.php');
    require_once('./inc/controller/get_team_members.php');
    require_once('./inc/controller/users-controller.php');

    function __sendNotification($artist, $paymentMethod, $user) {
        $brandName = $_SESSION['brand_name'];
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
		$subject = "A new payment method has been added to ". $artist->name;
        return sendEmail($emailAddresses, $subject, __generateEmailFromTemplate(
                                                            $artist->name, 
                                                            $paymentMethod->type, 
                                                            $paymentMethod->account_name, 
                                                            $paymentMethod->account_number_or_email,
                                                            $user->first_name . " " . $user->last_name,
                                                            $brandName
                                                    )
                        );
	}


    function __generateEmailFromTemplate($artistName, $bankName, $accountName, $accountNumber, $memberName, $brandName) {
		define ('TEMPLATE_LOCATION', 'assets/templates/add_payment_method_email.html', false);
		$file = fopen(TEMPLATE_LOCATION, 'r');
		$msg = fread($file, filesize(TEMPLATE_LOCATION));
		fclose($file);

        $msg = str_replace("%LOGO%", getProtocol() . $_SERVER['HTTP_HOST'] . "/" . $_SESSION['brand_logo'], $msg);
		$msg = str_replace('%ARTIST_NAME%', $artistName, $msg);
        $msg = str_replace('%BANK_NAME%', $bankName, $msg);
        $msg = str_replace('%ACCOUNT_NAME%', $accountName, $msg);
        $msg = str_replace('%ACCOUNT_NUMBER%', $accountNumber, $msg);
        $msg = str_replace('%MEMBER_NAME%', $memberName, $msg);
        $msg = str_replace('%BRAND%', $brandName, $msg);
		
		$msg = str_replace('%LINK%', getProtocol() . $_SERVER['HTTP_HOST'], $msg);
		
		return $msg;
	}

    $post = $_POST;

    $tokens = explode(",", $post['bank_selection']);
    $post['bank_code'] = $tokens[0];
    $post['type'] = $tokens[1];
    unset($post['bank_selection']);

    $payment = new PaymentMethod;
    $payment->fromFormPOST($post);
    if($payment->save()) {

        $artist = new Artist;
        $artist->fromID($post['artist_id']);

        // Get user details for audit trail
        $user = new User;
        $user->fromID($_SESSION['logged_in_user']);
        __sendNotification($artist, $payment, $user);

        redirectTo("/financial.php?action=addPaymentMethod&status=OK#payments");
    }
    else {
        redirectTo("/financial.php?action=addPaymentMethod&status=Failed#payments");
    }
?>