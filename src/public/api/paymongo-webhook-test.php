<?php 
    chdir("../..");
    include_once("./inc/util/Mailer.php");
    include_once("./inc/model/ticket.php");

    function sendAdminNotification($ticket) {
		$subject = "[TEST MODE] Payment for ticket # " . $ticket->id . " successful.";
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
		$subject = "[TEST MODE] Payment failure detected.";
		$emailAddresses[0] = "sy.dexter@gmail.com"; // TODO Replace with actual administrators later
        $body = "We detected a failed webhook event.<br>Reason: " . $reason;
		return sendEmail($emailAddresses, $subject, $body);
	}

    $jsonData = file_get_contents('php://input');

    $response = json_decode($jsonData, false);
    
    if (isset($response->data->attributes) && $response->data->attributes->data->type == 'link') {
        $ticket = new Ticket;
        if($ticket->fromPaymentLinkID($response->data->attributes->data->id)) {
            if(!sendAdminNotification($ticket)){
                sendAdminFailureNotification("Failed to send email.");
            }
        }
        else {
            sendAdminFailureNotification("Invalid payment link ID in JSON response.");
        }
    } else {
        sendAdminFailureNotification("Invalid JSON response.");
    }

    http_response_code(200); // Always respond success
?>