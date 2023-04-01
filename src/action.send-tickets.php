<?php
    require_once('./inc/config.php');
    require_once('./inc/model/ticket.php');
    require_once('./inc/model/event.php');
    require_once('./inc/util/Redirect.php');
	require_once('./inc/util/Mailer.php');
	require_once('./inc/controller/access_check.php');
	require_once('./inc/controller/brand_check.php');

    $GLOBALS['debugOutput'] = [];

    function sendTicketToEmail($emailAddress, $eventName, $name, $ticketCode, $numberOfEntries, $rsvpLink) {
		$subject = "Here's your ticket to ". $eventName . " on " . $eventDate . "!";
		$emailAddresses[0] = $emailAddress;
		return sendEmail($emailAddresses, $subject, generateEmailFromTemplate($eventName, $name, $ticketCode, $numberOfEntries, $rsvpLink));
	}

    function generateEmailFromTemplate($eventName, $name, $ticketCode, $numberOfEntries, $rsvpLink) {
		define ('TEMPLATE_LOCATION', 'assets/templates/event_ticket_email.html', false);
		$file = fopen(TEMPLATE_LOCATION, 'r');
		$msg = fread($file, filesize(TEMPLATE_LOCATION));
		fclose($file);

        $msg = str_replace("%BRAND_NAME%", $_SESSION['brand_name'], $msg);
		$msg = str_replace('%EVENT_NAME%', $eventName, $msg);
		$msg = str_replace('%NAME%', $name, $msg);
		$msg = str_replace('%TICKET_CODE%', $ticketCode, $msg);
		$msg = str_replace('%NO_OF_ENTRIES%', $numberOfEntries, $msg);
		$msg = str_replace('%RSVP_LINK%', $rsvpLink, $msg);
		
		return $msg;
	}


	if (isset($_GET['ticket_id'])){
		$ticket = new Ticket;
		$ticket->fromID($_GET['ticket_id']);
		$event = new Event;
		$event->fromID($ticket->event_id);

		$result = sendTicketToEmail(
			$ticket->email_address,
			$event->title,
			$ticket->name,
			$ticket->ticket_code,
			$ticket->number_of_entries,
			$event->date_and_time
		);
		if ($result) {
			$ticket->status = "Ticket sent.";
			$ticket->save();
		}
	}
	else if (isset($_GET['all'])) {
		// logic for sending to all
	}
	else if (isset($_GET['unsent'])) {
		// logic for sending to unsent
	}
	if($result) {
		redirectTo('/events.php?action=send');
	}
	else {
		redirectTo('/events.php?action=send&status=email_failed');
	}

    
    
?>