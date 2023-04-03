<?php
    require_once('./inc/config.php');
    require_once('./inc/model/ticket.php');
    require_once('./inc/util/Redirect.php');
	require_once('./inc/controller/access_check.php');
	require_once('./inc/controller/brand_check.php');

	if (isset($_GET['ticket_id'])){
		$ticket = new Ticket;
		$ticket->fromID($_GET['ticket_id']);
		$ticket->status = "Payment Confirmed";
		$ticket->save();
	}
	else if (isset($_GET['all'])) {
		// logic for sending to all
	}
	else if (isset($_GET['unsent'])) {
		// logic for sending to unsent
	}

	redirectTo('/events.php?action=paid');
    
?>