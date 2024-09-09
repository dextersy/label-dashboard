<?php
    require_once('./inc/config.php');
    require_once('./inc/model/ticket.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/controller/ticket-controller.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/util/Mailer.php');

    function sendPaymentReminder($emailAddress, $eventName, $name, $amount, $numberOfEntries, $paymentLink) {
		$subject = "[REMINDER] Complete your payment for ". $eventName;
		$emailAddresses[0] = $emailAddress;
		return sendEmail($emailAddresses, $subject, generateEmailFromTemplate($eventName, $name, $amount, $numberOfEntries, $paymentLink));
	}

    function generateEmailFromTemplate($eventName, $name, $amount, $numberOfEntries, $paymentLink) {
		define ('TEMPLATE_LOCATION', 'assets/templates/event_ticket_payment_reminder.html', false);
		$file = fopen(TEMPLATE_LOCATION, 'r');
		$msg = fread($file, filesize(TEMPLATE_LOCATION));
		fclose($file);

        $msg = str_replace("%BRAND_NAME%", $_SESSION['brand_name'], $msg);
		$msg = str_replace('%EVENT_NAME%', $eventName, $msg);
		$msg = str_replace('%NAME%', $name, $msg);
		$msg = str_replace('%PAYMENT_AMOUNT%', $amount, $msg);
		$msg = str_replace('%NO_OF_ENTRIES%', $numberOfEntries, $msg);
		$msg = str_replace('%PAYMENT_LINK%', $paymentLink, $msg);
		
		return $msg;
	}

    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }

    $tickets = getTicketsForEvent($_SESSION['current_event']);

    $event = new Event();
    $event->fromID($_SESSION['current_event']);

    $number_of_sent = 0;

    foreach($tickets as $ticket) {
        
        //echo $ticket->id . " - " . $ticket->payment_link . "<br>";
        if ($ticket->status == 'New' && isset($ticket->payment_link) && $ticket->payment_link != '') {
            $amount = $event->ticket_price * $ticket->number_of_entries;
            $success = sendPaymentReminder(
                $ticket->email_address, 
                $event->title, 
                $ticket->name, 
                $amount, 
                $ticket->number_of_entries, 
                $ticket->payment_link
            );
            if($success) {
                $number_of_sent++;
            }
        }
    }
    redirectTo("/events.php?action=paymentReminder&status=" . ($success ? "OK": "Failed") . "&count=" . $number_of_sent . "#tickets");
?>