<?
    include_once('./inc/controller/get_tickets.php');

    include_once('./inc/controller/brand_check.php');

    $tickets = getTicketsForEvent($_SESSION['current_event']);

    function getTicketStatusText($status, $payment_link) {
        if(!isset($payment_link)) {
            $color = 'red';
            $status = 'Error - no payment link';
        }
        else if ( $status == "New" ) {
            $color = 'grey';
        }
        else if ($status == "Payment Confirmed") {
            $color = 'orange';
        }
        else if ($status == "Ticket sent.") {
            $color = 'green';
        }
        return "<span style=\"color:". $color . ";\"><i class=\"fa fa-circle\" aria-hidden=\"true\"></i> " . $status . "</span> " . $link;
    }
    function getTicketLink($status, $payment_link) {
        if (!isset($payment_link)) {
            return "";
        }
        if ( $status == "New" ) {
            $link = "[ Mark as paid ]";
        }
        else if ($status == "Payment Confirmed") {
            $link = "<a href=\"action.send-tickets.php?ticket_id=" . $ticket->id . "\">[ Send Ticket ]</a>";
        }
        else if ($status == "Ticket sent.") {
            $link = "<a href=\"action.send-tickets.php?ticket_id=" . $ticket->id . "\">[ Resend Ticket ]</a>";
        }
        return $link;
    }
?>
<div class="row">
    <div class="col-md-6"><h3>Tickets</h3></div>
    <div class="col-md-6">
        <a href="action.verify-ticket-payments.php">
            <button class="btn">Verify Payments</button>
        </a>
    </div>
</div>
<div class="table-responsive">
    <table class="table">
        <thead>
            <tr><th>Name</th>
            <th>Email address</th>
            <th>Contact number</th>
            <th>No. of tickets</th>
            <th>Ticket code</th>
            <th>Status</th>
        </thead>
        <tbody>
<?
    if ($tickets) {
        foreach($tickets as $ticket) {
?>
            <tr>
                <td><?=$ticket->name; ?></td>
                <td><?=$ticket->email_address; ?></td>
                <td><?=$ticket->contact_number; ?></td>
                <td><?=$ticket->number_of_entries; ?></td>
                <td><strong><?=$ticket->ticket_code; ?></strong></td>
                <td><?=getTicketStatusText($ticket->status, $ticket->payment_link); ?></td>
                <td><?=getTicketLink($ticket->status, $ticket->payment_link); ?></td>
            </tr>
<?      }
    } else {
?>
    No tickets yet.
<?
    } 
?>
        </tbody>
    </table>
</div>
<div class="row">
    <div class="col-md-6">
        <h4>Add ticket</h4>
        <form action="action.add-ticket.php" method="POST">
        <div class="form-group">
            <input type="hidden" name="event_id" value="<?=$_SESSION['current_event'];?>">
            <input type="hidden" name="status" value="New">
            <input type="name" class="form-control" id="name" name="name" placeholder="name">
            <input type="email" class="form-control" id="email_address" name="email_address" placeholder="Email address">
            <input type="phone" class="form-control" id="contact_number" name="contact_number" placeholder="Contact number">
            <input type="text" class="form-control" id="number_of_entries" name="number_of_entries" placeholder="Number of tickets">
            <input type="submit" class="btn btn-primary" value="Add Ticket">
        </div>                 
        </form>
    </div>
</div>