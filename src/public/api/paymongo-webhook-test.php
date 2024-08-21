<?php 
    include_once("./inc/util/Mailer.php");

    function sendAdminNotification($data) {
		$subject = "Paymongo webhook event occurred";
		$emailAddresses[0] = "sy.dexter@gmail.com"; // TODO Replace with actual administrators later
        $body = "Data of type " + $data->data->attributes->type + " received.";
		return sendEmail($emailAddresses, $subject, $body);
	}

    function sendAdminFailureNotification() {
		$subject = "Paymongo webhook event failed";
		$emailAddresses[0] = "sy.dexter@gmail.com"; // TODO Replace with actual administrators later
        $body = "We detected a failed webhook event.";
		return sendEmail($emailAddresses, $subject, $body);
	}

    $jsonData = file_get_contents('php://input');
    $data = json_decode($jsonData, true);
    

    if ($data !== null) {
        sendAdminNotification($data);
    } else {
        sendAdminFailureNotification();
    }

    http_response_code(200); // Always respond success
?>