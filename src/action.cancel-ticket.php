<?php
    require_once('./inc/config.php');
    require_once('./inc/model/ticket.php');
    require_once('./inc/util/Redirect.php');
	require_once('./inc/controller/access_check.php');
	require_once('./inc/controller/brand_check.php');
    require_once('./inc/controller/ticket-controller.php');

    if(isset($_GET['all'])) {
        $count = 0;
        $tickets = getPendingTicketsForEvent($_SESSION['current_event']);
        foreach ($tickets as $ticket) {
            if(archiveTicket($ticket->id)) {
                $count++;
            }
        }
       	redirectTo('/events.php?action=cancelTicket&count='.$count.'&result=OK#pending');
    }
    else {
        $ticket_id = $_GET['ticket_id'];
        $result = archiveTicket($ticket_id);
        if(!$result) {
        	redirectTo('/events.php?action=cancelTicket&count=1&result=Failed#pending');
        }
        else {
        	redirectTo('/events.php?action=cancelTicket&count=1&result=OK#pending');
        }
    }
	
    if($archive)
    
?>