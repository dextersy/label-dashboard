<?
    chdir("../..");
    include_once("./inc/config.php");
    include_once("./inc/model/ticket.php");
    include_once("./inc/model/event.php");
    include_once("./inc/model/eventreferrer.php");
    include_once("./inc/model/user.php");
    include_once("./inc/util/Redirect.php");
    include_once("./inc/util/Mailer.php");
    include_once("./inc/controller/get_referrers.php");
    require_once('./inc/controller/get_team_members.php');
    require_once('./inc/controller/users-controller.php');

    function createCheckoutSession($event_id, $number_of_tickets, $price_per_ticket, $description) {
        $curl = curl_init();

        $params = json_encode([
            'data' => [
                'attributes' => [
                        'send_email_receipt' => false,
                        'show_description' => true,
                        'show_line_items' => true,
                        'line_items' => [
                            [
                                'currency' => 'PHP',
                                'amount' => $price_per_ticket * 100,
                                'name' => 'Tickets',
                                'quantity' => intval($number_of_tickets)
                            ]
                        ],
                        'payment_method_types' => [
                                        'gcash',
                                        'qrph',
                                        'card',
                                        'dob_ubp',
                                        'dob',
                                        'paymaya',
                                        'grab_pay' // TODO Make this selectable in event settings
                        ],
                        'description' => $description,
                        'success_url' => getProtocol() . $_SERVER['HTTP_HOST'] . "/public/tickets/success.php?id=" . $event_id
                ]
            ]
        ]);
        curl_setopt_array($curl, [
                CURLOPT_URL => "https://api.paymongo.com/v1/checkout_sessions",
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_ENCODING => "",
                CURLOPT_MAXREDIRS => 10,
                CURLOPT_TIMEOUT => 30,
                CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
                CURLOPT_CUSTOMREQUEST => "POST",
                CURLOPT_POSTFIELDS => $params,
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

    function sendAdminNotification($eventName, $ticket, $amount) {
        $i = 0;
        $admins = getAllAdmins($_SESSION['brand_id']);
        if ($admins != null) {
            foreach($admins as $recipient) {
                $emailAddresses[$i++] = $recipient->email_address;
            }
        }

        $referrerName = "";
        if (isset($ticket->referrer_id) && $ticket->referrer_id != '') {
            $referrer = new EventReferrer;
            $referrer->fromID($ticket->referrer_id);
            $referrerName = $referrer->name;
        }

		$subject = "New ticket order for ". $eventName;
		$body = "<h1>New ticket order</h1>";
        $body = $body . "<p>Name: " . $ticket->name . "<br>";
        $body = $body . "Email address: " . $ticket->email_address . "<br>";
        $body = $body . "Contact number: " . $ticket->contact_number . "<br>";
        $body = $body . "Ticket code: " . $ticket->ticket_code . "<br>";
        $body = $body . "Payment link ID: " . $ticket->payment_link_id . "<br>";
        $body = $body . "Amount: P" . number_format($amount, 2) . "<br>";
        $body = $body . "Referrer: " . $referrerName . "<br>";
        $body = $body . "No. of entries: " . $ticket->number_of_entries . "</p>";

		return sendEmail($emailAddresses, $subject, $body);
	}

    $ticket = new Ticket;
    $ticket->fromFormPOST($_POST);
    $ticket->status = "New";

    // Set referral code if applicable
    if(isset($_POST['referral_code']) && $_POST['referral_code'] != '') {
        $referrer = getReferrerFromCode($_POST['referral_code']);
        if(isset($referrer)) {
            $ticket->referrer_id = $referrer->id;
        }
    }

    // Generate ticket code
    $characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $randomString = '';
    for ($i = 0; $i < 5; $i++) {
        $randomString .= $characters[rand(0, strlen($characters) - 1)];
    }
    $ticket->ticket_code = $randomString;
    $ticket->save();

    $event = new Event;
    $event->fromID($ticket->event_id);

    $ticket->price_per_ticket = $event->ticket_price;
    $ticket->save();

    $amount = $event->ticket_price * $ticket->number_of_entries;
    $description = "Payment for " . $event->title . " - Ticket # " . $ticket->id;
    //$response = createPaymentLink($amount, $description);
    $response = createCheckoutSession($event->id, $ticket->number_of_entries, $ticket->price_per_ticket, $description);

    if(isset($response->data->attributes)) {
        // $ticket->payment_link = $response->data->attributes->checkout_url;
        // $ticket->payment_link_id = $response->data->id;
        // $ticket->save();

        // $result = sendPaymentLink(
        //     $ticket->email_address, 
        //     $event->title, 
        //     $ticket->name, 
        //     $amount, 
        //     $ticket->number_of_entries, 
        //     $ticket->payment_link
        // );
        $ticket->checkout_key = $response->data->attributes->client_key;
        $ticket->save();
        
        $checkout_url = $response->data->attributes->checkout_url;

        sendAdminNotification($event->title, $ticket, $amount);

        header('location: ' . $checkout_url);
        // if($result) {
        //     redirectTo("/public/tickets/pay.php?id=" . $ticket->id);
        // }
        // else {
        //     redirectTo("/public/tickets/buy.php?err");
        // }
    }
    else {
        redirectTo("/public/tickets/buy.php?err");
    }

?>