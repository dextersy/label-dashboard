<?php 
    chdir("../..");
    include_once("./inc/util/Mailer.php");
    include_once("./inc/model/brand.php");
    include_once("./inc/model/ticket.php");
    include_once("./inc/model/event.php");
    include_once("./inc/model/domain.php");
    include_once("./inc/util/Redirect.php");
    include_once("./inc/controller/ticket-controller.php");
    //include_once("./inc/controller/users-controller.php");

    function webhook_log($msg) {
        $fp = fopen('webhook.log', 'a');
        $date = "[" . date("Y/m/d h:i:sa") . "] ";
        fwrite($fp, $date . $msg . "\n");
    }

    function __getAdminEmails($brand_id){
        $sql = "SELECT `email_address` FROM `user` ".
            "WHERE `is_admin` IS TRUE and `brand_id` = '" . $brand_id . "'";
        $result = MySQLConnection::query($sql);
        if ($result->num_rows < 1) {
            return null;
        }
        
        $i = 0;
        while($row = $result->fetch_assoc()) {
            $emails[$i] = $row['email_address'];
            $i++;
        }
        return $emails;
    }
    function sendAdminNotification($event, $ticket, $domain) {
        $i = 0;
        $emailAddresses = __getAdminEmails($_SESSION['brand_id']);
        $subject = "New ticket order for " . $event->title . " completed.";
		$body = "Confirmed payment for the following ticket.<br><br>";
        $body = $body . "Ticket ID : " . $ticket->id . "<br>";
        $body = $body . "Name : " . $ticket->name . "<br>";
        $body = $body . "Email : " . $ticket->email_address . "<br>";
        $body = $body . "Code : " . $ticket->ticket_code . "<br>";
        $body = $body . "Number of entries : " . $ticket->number_of_entries . "<br>";
        $body = $body . "Payment : " . number_format($ticket->price_per_ticket * $ticket->number_of_entries, 2) . "<br>";
        $body = $body . "Processing fee : -" . number_format($ticket->payment_processing_fee, 2) . "<br>";
        $body = $body . "<br>";
        $body = $body . "Go to <a href=\"https://" . $domain . "/events.php#tickets\" target=\"_blank\">dashboard</a>";
		return sendEmail($emailAddresses, $subject, $body);
	}

    function sendAdminFailureNotification($reason) {
		$subject = "Link payment webhook error detected.";
		$emailAddresses[0] = "sy.dexter@gmail.com"; // TODO Replace with actual administrators later
        $body = "We detected a failed webhook event.<br>Reason: " . $reason;
		return sendEmail($emailAddresses, $subject, $body);
	}

    session_start();

    $jsonData = file_get_contents('php://input');
    $response = json_decode($jsonData, false);

    webhook_log('Received a webhook event : ' . $jsonData);
    
    if (isset($response->data->attributes) && ($response->data->attributes->data->type == 'link' || $response->data->attributes->data->type == 'checkout_session')) {
        webhook_log ('Valid JSON - type ' . $response->data->attributes->data->type);
        $found = false;
        $type = $response->data->attributes->data->type;
        $ticket = new Ticket;
        
        if($type == 'link') {
            $found = $ticket->fromPaymentLinkID($response->data->attributes->data->id);
        }
        else if($type == 'checkout_session')  {
            $found = $ticket->fromCheckoutKey($response->data->attributes->data->attributes->client_key);
        }
        $payments = $response->data->attributes->data->attributes->payments;

        if($found) {
            webhook_log ('Valid reference...');

            $processing_fee = 0;
            if($payments != null) {
                webhook_log ('Payments data is available...');
                foreach ($payments as $payment) {
                    if($type == 'checkout_session') $processing_fee += $payment->attributes->fee / 100;
                    else if($type == 'link') $processing_fee += $payment->data->attributes->fee / 100;
                }
            }

            // Set session brand based on ticket
            $event = new Event;
            $event->fromID($ticket->event_id);
            $brand = new Brand;
            $brand->fromID($event->brand_id);
            $_SESSION['brand_id'] = $brand->id;
            $_SESSION['brand_name'] = $brand->brand_name;
            $_SESSION['brand_logo'] = $brand->logo_url;
            $_SESSION['brand_color'] = $brand->brand_color;
            $_SESSION['brand_website'] = $brand->brand_website;
            webhook_log ('Set session brand = ' . $_SESSION['brand_name']);

            // SEnd email notifications
            if (!updateTicketPaymentStatus($ticket->id, $processing_fee)) {
                webhook_log ('ERROR: Failed to update ticket payment verification.');
                sendAdminFailureNotification("Ticket payment verification failed.");
            }
            else {
                webhook_log ('Attempting to send ticket...');
                if (!sendTicket($ticket->id)) {
                    webhook_log ('ERROR: Failed to send ticket...');
                    sendAdminFailureNotification("Failed to send ticket to customer.");
                }
                else {
                    $domains = Domain::getDomainsForBrand($brand->id);
                    $ticket->fromID($ticket->id);
                    if(!sendAdminNotification($event, $ticket, (count($domains) > 0) ? $domains[0]->domain_name : $_SERVER['SERVER_NAME'])){
                        webhook_log ('ERROR: Failed to send admin notification.');
                        sendAdminFailureNotification("Failed to send email.");
                    }
                }
            }
        }
        else {
            webhook_log ('ERROR : Reference is not valid.');
            sendAdminFailureNotification("Invalid reference value in JSON response.");
        }
    } else {
        webhook_log ('ERROR : JSON data is not valid.');
        sendAdminFailureNotification("Invalid JSON data : " . $jsonData);
    }
    session_destroy();
    http_response_code(200); // Always respond success TODO: Maybe we shouldn't?
?>