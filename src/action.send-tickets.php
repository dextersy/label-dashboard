<?php
    require_once('./inc/config.php');
    require_once('./inc/model/ticket.php');
    require_once('./inc/model/event.php');
    require_once('./inc/util/Redirect.php');
	require_once('./inc/controller/access_check.php');
	require_once('./inc/controller/brand_check.php');
	require_once('./inc/controller/ticket-controller.php');

	if (isset($_GET['ticket_id'])){
		$result = sendTicket($_GET['ticket_id']);
	}
	else if (isset($_GET['all'])) {
		// logic for sending to all
	}
	else if (isset($_GET['unsent'])) {
		// logic for sending to unsent
	}

	if($result) {
		redirectTo('/events.php?action=send#tickets');
	}
	else {
		redirectTo('/events.php?action=send&status=email_failed#tickets');
	}

    
    
?>