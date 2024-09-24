<?
    chdir("../..");
    include_once("./inc/config.php");
    include_once("./inc/model/ticket.php");
    include_once("./inc/util/Redirect.php");
    
    $ticket = new Ticket;
    if($ticket->fromEventIdAndTicketCode($_POST['event_id'], $_POST['ticket_code'])) {
        if($ticket->status == 'Ticket sent.') {
            $ticket->number_of_claimed_entries += $_POST['number_of_attendees'];
            if($ticket->save()) {
                redirectTo('/public/tickets/verify.php?success&id=' . $_POST['event_id']);
                die();
            }
        }
    }
    redirectTo('/public/tickets/verify.php?err&id=' . $_POST['event_id']);
?>