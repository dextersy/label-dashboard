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

    $pending = (isset($_GET['pending'])) ? true : false;
    $event = new Event;
    $event->fromID($_GET['id']);
    $downloadToken = $_GET['token'];
    
    header('Content-Type: application/csv');
    header('Content-Disposition: attachment; filename="' . str_replace(' ', '_', $event->title) . '_tickets' . ($pending ? "_pending" : "") . '.csv";');

    $file = fopen("php://output", "w");
    fputcsv($file, ["Ticket list for " . $event->title]);
    fputcsv($file, ["-----"]);
    $headers = ['Name', 'Email Address', 'Contact Number', 'No. of Tickets', 'Ticket Code', 'Notes'];
    if($all) { array_push($headers, 'Status'); }

    fputcsv($file, $headers);

    if(!$pending) {
        $tickets = getTicketsForEvent($event->id);
    }
    else {
        $tickets = getPendingTicketsForEvent($event->id);
    }

    foreach ($tickets as $ticket) {
        $line = [$ticket->name, $ticket->email_address, $ticket->contact_number, $ticket->number_of_entries, $ticket->ticket_code, ''];
        if($pending) { array_push($line, $ticket->status); }
        fputcsv($file, $line);
    }
    
    setcookie(
        'downloadToken',
        $downloadToken,
        2147483647,            // expires January 1, 2038
        "/",                   // your path
        $_SERVER["HTTP_HOST"], // your domain
        $secure,               // Use true over HTTPS
        $httpOnly              // Set true for $AUTH_COOKIE_NAME
    );
?>