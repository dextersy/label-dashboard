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

    $all = ($_GET['all'] == '1') ? true : false;
    $event = new Event;
    $event->fromID($_GET['id']);
    $downloadToken = $_GET['token'];
    
    header('Content-Type: application/csv');
    header('Content-Disposition: attachment; filename="' . str_replace(' ', '_', $event->title) . '_tickets.csv";');

    $file = fopen("php://output", "w");
    fputcsv($file, ["Ticket list for " . $event->title]);
    fputcsv($file, ["-----"]);
    $headers = ['Name', 'Email Address', 'Contact Number', 'No. of Tickets', 'Ticket Code', 'Notes'];
    if($all) { array_push($headers, 'Status'); }

    fputcsv($file, $headers);

    $tickets = getTicketsForEvent($event->id);

    foreach ($tickets as $ticket) {
        if($all || $ticket->status == "Ticket sent.") {
            $line = [$ticket->name, $ticket->email_address, $ticket->contact_number, $ticket->number_of_entries, $ticket->ticket_code, ''];
            if($all) { array_push($line, $ticket->status); }
            fputcsv($file, $line);
        }
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