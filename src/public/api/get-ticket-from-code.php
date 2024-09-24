<?
    chdir("../..");
    include_once("./inc/model/ticket.php");
    include_once("./inc/model/event.php");

    if($_SERVER['REQUEST_METHOD'] == 'POST') {
        $json = file_get_contents("php://input");
        $event_id = $_POST['event_id'];
        $verification_pin = $_POST['verification_pin'];
        $ticket_code = $_POST['ticket_code'];

        $event = new Event;
        $event->fromID($event_id);
        if($verification_pin != $event->verification_pin) {
            http_response_code(403); //FORBIDDEN
            die();
        }

        $ticket = new Ticket;
        if($ticket->fromEventIdAndTicketCode($event->id, $ticket_code)) {
            if($ticket->status == 'Ticket sent.') {
                echo json_encode($ticket);
                die();
            }
            else {
                http_response_code(404);
                die();
            }
        }
        else {
            http_response_code(404); // NO RESPONSE
            die();
        }
        
    }
?>