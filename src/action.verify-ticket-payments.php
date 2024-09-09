<?php
    require_once('./inc/config.php');
    require_once('./inc/model/ticket.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/controller/ticket-controller.php');
    require_once('./inc/util/Redirect.php');
 
    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }
    $count = 0;
    $tickets = getTicketsForEvent($_SESSION['current_event']);
    foreach($tickets as $ticket) {
        if(isset($ticket->payment_link)) {
            if(updateTicketPaymentStatus($ticket->id)) {
                $count++;
            }
        }
    }
    redirectTo("/events.php?action=VerifyPayments&count=" . $count ."#tickets");
?>