<?php
    require_once('./inc/model/ticket.php');
    require_once('./inc/controller/access_check.php');

    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }

    $ticket = new Ticket;
    $ticket->fromFormPOST($_POST);

    // Generate ticket code
    $characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $randomString = '';
    for ($i = 0; $i < 5; $i++) {
        $randomString .= $characters[rand(0, strlen($characters) - 1)];
    }
    $ticket->ticket_code = $randomString;

    $ticket->save();

    redirectTo("/events.php#tickets");
?>