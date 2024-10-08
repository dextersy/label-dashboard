<?php
    require_once('./inc/model/ticket.php');
    require_once('./inc/model/event.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/util/Mailer.php');
    require_once('./inc/controller/get_referrers.php');

    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }

    include_once("./inc/util/Mailer.php");

    function createPaymentLink($amount, $description) {

        $curl = curl_init();

        curl_setopt_array($curl, [
                CURLOPT_URL => "https://api.paymongo.com/v1/links",
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_ENCODING => "",
                CURLOPT_MAXREDIRS => 10,
                CURLOPT_TIMEOUT => 30,
                CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
                CURLOPT_CUSTOMREQUEST => "POST",
                CURLOPT_POSTFIELDS => "{\"data\":{\"attributes\":{\"amount\":". $amount*100 . ",\"description\":\"" . $description . "\"}}}",
                CURLOPT_HTTPHEADER => [
                    "accept: application/json",
                    "authorization: Basic " . base64_encode(PAYMONGO_SECRET_KEY),
                    "content-type: application/json"
                ],
            ]);

        $response = curl_exec($curl);
        $err = curl_error($curl);

        curl_close($curl);

        if ($err) {
            return $err;
        } else {
            return json_decode($response, false);
        }
    }

    $GLOBALS['debugOutput'] = [];

    function sendPaymentLink($emailAddress, $eventName, $name, $amount, $numberOfEntries, $paymentLink) {
		$subject = "Complete your payment for ". $eventName;
		$emailAddresses[0] = $emailAddress;
		return sendEmail($emailAddresses, $subject, generateEmailFromTemplate($eventName, $name, $amount, $numberOfEntries, $paymentLink));
	}

    function generateEmailFromTemplate($eventName, $name, $amount, $numberOfEntries, $paymentLink) {
		define ('TEMPLATE_LOCATION', 'assets/templates/event_ticket_payment_link.html', false);
		$file = fopen(TEMPLATE_LOCATION, 'r');
		$msg = fread($file, filesize(TEMPLATE_LOCATION));
		fclose($file);

        $msg = str_replace("%BRAND_NAME%", $_SESSION['brand_name'], $msg);
		$msg = str_replace('%EVENT_NAME%', $eventName, $msg);
		$msg = str_replace('%NAME%', $name, $msg);
		$msg = str_replace('%PAYMENT_AMOUNT%', number_format($amount, 2), $msg);
		$msg = str_replace('%NO_OF_ENTRIES%', $numberOfEntries, $msg);
		$msg = str_replace('%PAYMENT_LINK%', $paymentLink, $msg);
		
		return $msg;
	}

    function sendAdminNotification($eventName, $name, $amount, $numberOfEntries) {
		$subject = "New ticket order for ". $eventName;
		$emailAddresses[0] = "sy.dexter@gmail.com"; // @todo Replace with actual admin
        $body = "<h1>New ticket order</h1>";
        $body = $body . "<p>Name: " . $name . "<br>";
        $body = $body . "Amount: P" . $amount . "<br>";
        $body = $body . "No. of entries: " . $numberOfEntries . "</p>";

		return sendEmail($emailAddresses, $subject, $body);
	}

    $ticket = new Ticket;
    $ticket->fromFormPOST($_POST);

    // Set referral code, if applicable
    if(isset($_POST['referral_code']) && $_POST['referral_code'] != '') {
        $referrer = getReferrerFromCode($_POST['referral_code']);
        if(isset($referrer)) {
            $ticket->referrer_id = $referrer->id;
        }
    }

    // Generate ticket code
    $characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $randomString = '';
    $existingTicket = new Ticket;
    do {
        for ($i = 0; $i < 5; $i++) {
            $randomString .= $characters[rand(0, strlen($characters) - 1)];
        }
    } while ($existingTicket->fromEventIdAndTicketCode($ticket->event_id, $randomString)); // Check if ticket code exists
    $ticket->ticket_code = $randomString;

    $ticket->save();

    $event = new Event;
    $event->fromID($ticket->event_id);

    if(!isset($_POST['price_per_ticket']) || $_POST['price_per_ticket'] == '') {
        $ticket->price_per_ticket = $event->ticket_price;
        $ticket->save();
    }

    $amount = $ticket->price_per_ticket * $ticket->number_of_entries;
    $description = "Payment for " . $event->title . " - Ticket # " . $ticket->id;
    $response = createPaymentLink($amount, $description);

    if(isset($response->data->attributes)) {
        $ticket->payment_link = $response->data->attributes->checkout_url;
        $ticket->payment_link_id = $response->data->id;
        $ticket->save();

        if($_POST['send_email']=='1') {
            $result = sendPaymentLink(
                $ticket->email_address, 
                $event->title, 
                $ticket->name, 
                $amount, 
                $ticket->number_of_entries, 
                $ticket->payment_link
            );

            // Decided not to send admin notifications anymore for pending orders, only upon payment
//            sendAdminNotification($event->title, $ticket->name, $amount, $ticket->number_of_entries);
        
            if(!$result) {
                redirectTo("/events.php?err#pending");
            }
        }
    }
    else {
        // todo Add error message
    }
    redirectTo("/events.php#pending");
?>