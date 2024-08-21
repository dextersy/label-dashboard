<?php 
    chdir("../..");
    include_once("./inc/util/Mailer.php");

    function sendAdminNotification($jsonData) {
		$subject = "Paymongo webhook event received.";
		$emailAddresses[0] = "sy.dexter@gmail.com"; // TODO Replace with actual administrators later
        $body = "Received a webhook event.<br>" . $jsonData;
		return sendEmail($emailAddresses, $subject, $body);
	}

    function sendAdminFailureNotification() {
		$subject = "Paymongo webhook event failed";
		$emailAddresses[0] = "sy.dexter@gmail.com"; // TODO Replace with actual administrators later
        $body = "We detected a failed webhook event.";
		return sendEmail($emailAddresses, $subject, $body);
	}

    $jsonData = file_get_contents('php://input');
    sendAdminNotification($jsonData);

    $data = json_decode($jsonData, true);
    

    if ($data !== null) {

    } else {
        sendAdminFailureNotification();
    }

    http_response_code(200); // Always respond success
?>