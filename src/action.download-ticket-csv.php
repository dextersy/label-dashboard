<?php
    require_once('./inc/config.php');
    require_once('./inc/model/ticket.php');
    require_once('./inc/util/Redirect.php');
	require_once('./inc/controller/access_check.php');
	require_once('./inc/controller/ticket-controller.php');
    
    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }

    $event = new Event;
    $event->fromID($_GET['id']);
    
    header('Content-Type: application/csv');
    header('Content-Disposition: attachment; filename="' . str_replace(' ', '_', $event->title) . '_tickets.csv";');

    $file = fopen("php://output", "w");
    fputcsv($file, ["Ticket list for " . $event->title]);
    fputcsv($file, ["-----"]);
    $headers = ['Name', 'Email Address', 'Contact Number', 'No. of Tickets', 'Ticket Code', 'Notes'];
    fputcsv($file, $headers);

    $tickets = getTicketsForEvent($event->id);

    foreach ($tickets as $ticket) {
        if($ticket->status == "Ticket sent.") {
            $line = [$ticket->name, $ticket->email_address, $ticket->contact_number, $ticket->number_of_entries, $ticket->ticket_code, ''];
            fputcsv($file, $line);
        }
    }
    
?>