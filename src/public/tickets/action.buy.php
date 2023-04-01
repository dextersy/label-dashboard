<?
    chdir("../..");
    include_once("./inc/model/ticket.php");
    include_once("./inc/util/Redirect.php");

    $ticket = new Ticket;
    $ticket->fromFormPOST($_POST);
    $ticket->status = "New";
     // Generate ticket code
     $characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
     $randomString = '';
     for ($i = 0; $i < 5; $i++) {
         $randomString .= $characters[rand(0, strlen($characters) - 1)];
     }
     $ticket->ticket_code = $randomString;
    $ticket->save();

    // todo Generate payment link

    // todo Send notification

    redirectTo("/public/tickets/pay.php?id=" . $ticket->id);
?>