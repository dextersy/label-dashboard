<?php 
    chdir("../..");
    include_once("./inc/util/Mailer.php");
    include_once("./inc/model/brand.php");
    include_once("./inc/model/ticket.php");
    include_once("./inc/model/event.php");
    include_once("./inc/util/Redirect.php");
    include_once("./inc/controller/ticket-controller.php");

    function webhook_log($msg) {
        $fp = fopen('webhook.log', 'a');
        $date = "[" . date("Y/m/d h:i:sa") . "] ";
        fwrite($fp, $date . $msg . "\n");
    }

    function sendAdminNotification($ticket) {
		$subject = "Payment for ticket # " . $ticket->id . " successful.";
		$emailAddresses[0] = "sy.dexter@gmail.com"; // TODO Replace with actual administrators later
        $body = "Confirmed payment for the following ticket.<br><br>";
        $body = $body . "Ticket ID : " . $ticket->id . "<br>";
        $body = $body . "Name : " . $ticket->name . "<br>";
        $body = $body . "Email : " . $ticket->email_address . "<br>";
        $body = $body . "Code : " . $ticket->ticket_code . "<br>";
        $body = $body . "<br>";
        $body = $body . "Go to <a href=\"https://" . $_SERVER['SERVER_NAME'] . "\" target=\"_blank\">dashboard</a>";
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
    
    if (isset($response->data->attributes) && $response->data->attributes->data->type == 'link') {
        webhook_log ('Valid JSON - type link.');
        $ticket = new Ticket;
        if($ticket->fromPaymentLinkID($response->data->attributes->data->id)) {
            webhook_log ('Valid payment link ID...');
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
            if(!sendAdminNotification($ticket)){
                webhook_log ('ERROR: Failed to send admin notification.');
                sendAdminFailureNotification("Failed to send email.");
            }
            if (!updateTicketPaymentStatus($ticket->id)) {
                webhook_log ('ERROR: Failed to update ticket payment verification.');
                sendAdminFailureNotification("Ticket payment verification failed.");
            }
            else {
                webhook_log ('Attempting to send ticket...');
                if (!sendTicket($ticket->id)) {
                    webhook_log ('ERROR: Failed to send ticket...');
                    sendAdminFailureNotification("Failed to send ticket to customer.");
                }
            }
        }
        else {
            webhook_log ('ERROR : payment link ID is not valid.');
            sendAdminFailureNotification("Invalid payment link ID in JSON response - " . $response->data->attributes->data->id);
        }
    } else {
        webhook_log ('ERROR : JSON data is not valid.');
        sendAdminFailureNotification("Invalid JSON data : " . $jsonData);
    }
    session_destroy();
    http_response_code(200); // Always respond success TODO: Maybe we shouldn't?
?>