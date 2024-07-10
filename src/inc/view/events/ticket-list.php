<?
    include_once('./inc/controller/get_tickets.php');

    include_once('./inc/controller/brand_check.php');
    include_once('./inc/model/eventreferrer.php');

    $tickets = getTicketsForEvent($_SESSION['current_event']);
    $paid = 0; $new = 0;
    if ($tickets) {
        $total_sold = 0;
        $total_processing_fee = 0;
        foreach($tickets as $ticket) {
            if($ticket->status == 'New') $new += $ticket->number_of_entries;
            if($ticket->status == 'Ticket sent.' || $ticket->status == 'Payment Confirmed') $paid += $ticket->number_of_entries;
            $total_processing_fee += (isset($ticket->payment_processing_fee) ? $ticket->payment_processing_fee : 0);
            $total_sold += ($ticket->status == 'Ticket sent.' || $ticket->status == 'Payment Confirmed') ? ($ticket->number_of_entries * $ticket->price_per_ticket) : 0;
        }
    } 

    function getTicketStatusText($status, $payment_link) {
        if(!isset($payment_link)) {
            $color = 'red';
            $status = 'Error - no payment link';
        }
        else if ( $status == "New" ) {
            $color = 'black';
        }
        else if ($status == "Payment Confirmed") {
            $color = 'orange';
        }
        else if ($status == "Ticket sent.") {
            $color = 'green';
        }
        else if ($status == "Canceled") {
            $color = 'grey';
        }
        return "<span style=\"color:". $color . ";\"><i class=\"fa fa-circle\" aria-hidden=\"true\"></i> " . $status . "</span> " . $link;
    }
    function getTicketLink($id, $status, $payment_link) {
        if (!isset($payment_link)) {
            return "";
        }
        if ( $status == "New" ) {
            $link = "<a href=\"action.mark-ticket-paid.php?ticket_id=" . $id . "\">[ Mark as paid ]</a> " .
                        "<a href=\"action.cancel-ticket.php?ticket_id=" . $id . "\">[ Cancel ]</a> ";
        }
        else if ($status == "Payment Confirmed") {
            $link = "<a href=\"action.send-tickets.php?ticket_id=" . $id . "\">[ Send Ticket ]</a>";
        }
        else if ($status == "Ticket sent.") {
            $link = "<a href=\"action.send-tickets.php?ticket_id=" . $id . "\">[ Resend Ticket ]</a>";
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
        &nbsp;
        <a href="action.send-payment-reminders.php">
            <button class="btn">Send Payment Reminder</button>
        </a>
        <br>
        Total paid: <?=$paid;?>, total pending: <?=$new;?>, paid amount: <?=number_format($total_sold,2);?>, total fees: <?=number_format($total_processing_fee,2);?>
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
            <th>Payment Link</th>
            <th>Total paid</th>
            <th>Processing fee</th>
            <th>Referred by</th>
            <th>Status</th>
        </thead>
        <tbody>
<?
    if ($tickets) {
        foreach($tickets as $ticket) {
            if(isset($ticket->referrer_id)) {
                $referrer = new EventReferrer;
                $referrer->fromID($ticket->referrer_id);
            }
            else {
                $referrer = null;
            }
?>
            <tr>
                <td><?=$ticket->name; ?></td>
                <td><?=$ticket->email_address; ?></td>
                <td><?=$ticket->contact_number; ?></td>
                <td><?=$ticket->number_of_entries; ?></td>
                <td><strong><?=$ticket->ticket_code; ?></strong></td>
                <td><a href="<?=$ticket->payment_link; ?>"><i class="fa fa-copy"></i></a></td>
                <td style="text-align:right;"><?=($ticket->status == 'Ticket sent.' || $ticket->status == 'Payment Confirmed')? number_format($ticket->price_per_ticket*$ticket->number_of_entries, 2) : "-";?></td>
                <td style="text-align:right;"><?=($ticket->status == 'Ticket sent.' || $ticket->status == 'Payment Confirmed')? number_format($ticket->payment_processing_fee, 2) : "-";?></td>
                <td><?=isset($referrer) ? $referrer->name : ""; ?></td>
                <td><?=getTicketStatusText($ticket->status, $ticket->payment_link); ?></td>
                <td><?=getTicketLink($ticket->id, $ticket->status, $ticket->payment_link); ?></td>
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
            <input type="text" class="form-control" id="referral_code" name="referral_code" placeholder="Referral code (optional)">
            <input class="form-check-input" type="checkbox" value="1" name="send_email" id="send_email"><label class="form-check-label" for="flexCheckDefault">Send payment email</label>
            <input type="submit" class="btn btn-primary" value="Add Ticket">
        </div>                 
        </form>
    </div>
</div>