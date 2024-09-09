<?
    include_once('./inc/controller/ticket-controller.php');

    include_once('./inc/controller/brand_check.php');
    include_once('./inc/model/eventreferrer.php');

    function getTicketStatusText($status, $payment_link, $checkout_key) {
        if(!isset($payment_link) && !isset($checkout_key)) {
            $color = 'red';
            $status = 'Error - no payment link nor checkout key';
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
    function getTicketLink($id, $status) {
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
    $event = new Event;
    $event->fromID($_SESSION['current_event']);

    
?>
<script type="text/javascript">
    function enablePriceOverride() {
        var txtPrice = document.getElementById('txt_price_per_ticket');
        txtPrice.disabled = false;
        txtPrice.focus();
        txtPrice.select();
    }
</script>
<div class="row">
    <div class="col-md-4"><h3>Tickets</h3></div>
</div>
<div class="row">
    <div class="card">
        <div class="card-header">
            <div class="col-md-12">
                <div class="btn-toolbar" role="toolbar">
                    <div class="btn-group" role="group" aria-label="Actions">
                        <button class="btn-link dropdown-toggle" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                            <i class="fa fa-download"></i> Download CSV <span class="caret"></span>
                            </button>
                            <ul class="dropdown-menu" aria-labelledby="dropdownMenuButton">
                                <li><a class="dropdown-item" href="action.download-ticket-csv.php?id=<?=$_SESSION['current_event'];?>">With ticket</a></li>
                                <li><a class="dropdown-item" href="action.download-ticket-csv.php?id=<?=$_SESSION['current_event'];?>&all=1">All</a></li>
                            </ul>
                            &nbsp;
                        <a href="action.verify-ticket-payments.php">
                            <button type="button" class="btn-link">
                                <i class="fa fa-check"></i> Verify Payments
                            </button>
                        </a>
                        &nbsp;
                        <a href="action.send-payment-reminders.php">
                            <button type="button" class="btn-link">
                                <i class="fa fa-bell"></i> Send payment reminders
                            </button>
                        </a>
                    </div>
                </div>
            </div>
        </div>
        <div class="card-body">
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
                        <th>Time ordered</th>
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
                            <td>
                                <? if(isset($ticket->payment_link) && $ticket->payment_link != '') { ?> 
                                <a href="<?=$ticket->payment_link; ?>"><i class="fa fa-copy"></i></a></td>
                                <? } ?>
                            <td style="text-align:right;"><?=($ticket->status == 'Ticket sent.' || $ticket->status == 'Payment Confirmed')? number_format($ticket->price_per_ticket*$ticket->number_of_entries, 2) : "-";?></td>
                            <td style="text-align:right;"><?=($ticket->status == 'Ticket sent.' || $ticket->status == 'Payment Confirmed')? number_format($ticket->payment_processing_fee, 2) : "-";?></td>
                            <td><?=isset($referrer) ? $referrer->name : ""; ?></td>
                            <td><?=isset($ticket->order_timestamp) ? $ticket->order_timestamp : "-";?></td>
                            <td><?=getTicketStatusText($ticket->status, $ticket->payment_link, $ticket->checkout_key); ?></td>
                            <td><?=getTicketLink($ticket->id, $ticket->status); ?></td>
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
        </div>
        <div class="card-footer">
            <strong>Totals </strong>&nbsp;&nbsp;
                <i class="fa fa-circle" style="color:green;" title="Number of paid tickets"></i> <?=$paid;?>&nbsp;&nbsp;
                <i class="fa fa-circle" style="color:yellow;" title="Number of pending tickets"></i> <?=$new;?>&nbsp;&nbsp;
                <i class="fa fa-money" title="Total revenue"></i> Php<?=number_format($total_sold,2);?>&nbsp;&nbsp;
                <i class="fa fa-credit-card" title="Total processing fee"></i> -<?=number_format($total_processing_fee,2);?>
        </div>
    </div>
</div>

<div class="row">
    <div class="col-md-5">
    <form action="action.add-ticket.php" method="POST">

        <div class="card">
            <div class="card-header">
                <h5>Add ticket</h5>
            </div>
            <div class="card-body">
                <input type="hidden" name="event_id" value="<?=$_SESSION['current_event'];?>">
                <input type="hidden" name="status" value="New">
                <div class="form-group">
                    <label for="txt_name">Name</label>
                    <input type="name" class="form-control" id="txt_name" name="name" placeholder="Name" required>
                </div>
                <div class="form-group">
                    <label for="txt_email_address">Email address</label>
                    <input type="email" class="form-control" id="txt_email_address" name="email_address" placeholder="Email address" required>
                </div>
                <div class="form-group">
                    <label for="txt_contact_number">Contact number</label>
                    <input type="phone" class="form-control" id="txt_contact_number" name="contact_number" placeholder="Contact number" required>
                </div>
                <div class="form-group">
                    <label for="txt_number_of_entries">Number of entries</label>
                    <input type="text" class="form-control" id="txt_number_of_entries" name="number_of_entries" placeholder="Number of tickets" required>
                </div>
                <div class="form-group">
                    <label for="txt_email_address">Price per ticket</label>
                        <div class="input-group">
                            <div class="input-group-addon">Php</div>
                            <input type="text" class="form-control" id="txt_price_per_ticket" name="price_per_ticket" placeholder="Price per ticket" value="<?=$event->ticket_price;?>" disabled>
                            <div class="input-group-btn"><button type="button" class="btn" onclick="enablePriceOverride();"><i class="fa fa-pencil"></i></div>
                        </div>
                </div>
                <div class="form-group">
                    <label for="txt_email_address">Referral code (optional)</label>
                    <input type="text" class="form-control" id="txt_referral_code" name="referral_code" placeholder="Referral code (optional)">
                </div>
                <div class="form-group">
                    <input class="form-check-input" type="checkbox" value="1" name="send_email" id="checkbox_send_email"><label class="form-check-label" for="checkbox_send_email">Send payment email</label>
                </div>
            </div>
            <div class="card-footer">
                <input type="submit" class="btn btn-block" value="Add Ticket">
            </div>
        </div>
    </form>
    </div>
</div>