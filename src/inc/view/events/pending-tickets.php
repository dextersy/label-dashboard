<?
    include_once('./inc/controller/ticket-controller.php');

    include_once('./inc/controller/brand_check.php');
    include_once('./inc/model/eventreferrer.php');

    function getTicketStatusText($status, $payment_link, $checkout_key) {
        if ( $status == "New" ) {
            if(!isset($payment_link) && !isset($checkout_key)) {
                $color = 'red';
                $status = 'Error - no payment link nor checkout key';
            }
            else {
                $color = 'black';
            }
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
        return "<span style=\"color:". $color . ";\"><i class=\"fa fa-circle\" aria-hidden=\"true\"></i> " . $status . "</span>";
    }
    function getTicketLink($id, $status) {
        if ( $status == "New" ) {
            $link = "<a href=\"action.mark-ticket-paid.php?ticket_id=" . $id . "\">[ Mark as paid ]</a> " .
                        "<a href=\"action.cancel-ticket.php?ticket_id=" . $id . "\">[ Cancel ]</a> ";
        }
        else if ($status == "Payment Confirmed") {
            $link = "<a href=\"action.send-tickets.php?ticket_id=" . $id . "\">[ Send Ticket ]</a>";
        }
        return $link;
    }

    
    $tickets = getPendingTicketsForEvent($_SESSION['current_event']);
    $count = 0;
    foreach($tickets as $ticket) {
        $count += $ticket->number_of_entries;
    }
    $event = new Event;
    $event->fromID($_SESSION['current_event']);

    // To wait for file download
    $downloadToken = md5(random_int(111111,999999));
    
?>
<script type="text/javascript">
    function enablePriceOverride() {
        var txtPrice = document.getElementById('txt_price_per_ticket');
        txtPrice.disabled = false;
        txtPrice.focus();
        txtPrice.select();
    }

    function onToggleMarkAsPaid() {
        var checkboxMarkAsPaid = document.getElementById('checkbox_ticket_paid');
        var divPaymentProcessingFee = document.getElementById('div_payment_processing_fee');
        var divSendPaymentLink = document.getElementById('div_send_payment_link');
        var checkboxSendPaymentLink = document.getElementById('checkbox_send_email');
        
        if(checkboxMarkAsPaid.checked) {
            divPaymentProcessingFee.style.display = 'block';
            checkboxSendPaymentLink.checked = false;
            divSendPaymentLink.style.display = 'none';
        }
        else {
            divPaymentProcessingFee.style.display = 'none';
            divSendPaymentLink.style.display = 'block';
        }
    }

    function getCookie( name ) {
        var parts = document.cookie.split(name + "=");
        if (parts.length == 2) return parts.pop().split(";").shift();
    }
    function expireCookie( cName ) {
        document.cookie = 
            encodeURIComponent(cName) + "=deleted; expires=" + new Date( 0 ).toUTCString();
    }
    var downloadTimer;
    var attempts = 300; // 30 seconds timeout
    function waitForFile() {
        var downloadToken = '<?=$downloadToken;?>';

        downloadTimer = window.setInterval( function() {
            var token = getCookie( "downloadToken" );
            if( (token == downloadToken) || (attempts == 0) ) {
                hideOverlay();
            }
            attempts--;
        }, 100 );
    }

    function hideOverlay() {
        var overlay = document.getElementById('loadingOverlay');
        overlay.style.display = 'none';
        window.clearInterval( downloadTimer );
        expireCookie( "downloadToken" );
        attempts = 300;
    }
</script>
<div class="row">
    <div class="col-md-4"><h3>Abandoned Orders</h3></div>
</div>
<div class="row">
    <div class="card">
        <div class="card-header">
            <div class="col-md-12">
                <div class="btn-toolbar" role="toolbar">
                    <div class="btn-group" role="group" aria-label="Actions">
                        <a onclick="waitForFile();" href="action.download-ticket-csv.php?id=<?=$_SESSION['current_event'];?>&token=<?=$downloadToken;?>&pending">
                            <button type="button" class="btn-link">
                                <i class="fa fa-download"></i> Download CSV
                            </button>
                        </a>
                        <a href="action.verify-ticket-payments.php">
                            <button type="button" class="btn-link">
                                <i class="fa fa-check"></i> Verify Payments
                            </button>
                        </a>
                        <a href="action.send-payment-reminders.php">
                            <button type="button" class="btn-link">
                                <i class="fa fa-bell"></i> Send payment reminders
                            </button>
                        </a>
                        <a href="action.cancel-ticket.php?all">
                            <button type="button" class="btn-link text-danger">
                                <i class="fa fa-times"></i> Cancel all unpaid
                            </button>
                        </a>
                    </div>
                </div>
            </div>
        </div>
        <div class="card-body">
            <div class="table-responsive">
                <table class="table" id="tblPendingOrders">
                    <thead>
                        <tr><th>Name</th>
                        <th>Email address</th>
                        <th>Contact number</th>
                        <th data-sortas="numeric">No. of tickets</th>
                        <th>Payment Link</th>
                        <th>Referred by</th>
                        <th>Time ordered</th>
                        <th>Status</th>
                        <th></th>
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
                            <td>
                                <? if(isset($ticket->payment_link) && $ticket->payment_link != '') { ?> 
                                <a href="<?=$ticket->payment_link; ?>"><i class="fa fa-copy"></i></a></td>
                                <? } ?>
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
        <div class="card-footer" style="position:sticky;bottom:0;background-color:#f6f6f6;">
            <strong>Totals </strong>&nbsp;&nbsp;
                <i class="fa fa-dot-circle-o" style="color:gray;" title="Number of paid tickets"></i> <?=$count;?>&nbsp;&nbsp;
        </div>
    </div>
</div>

<div class="row">
    <div class="col-md-5">
    <form action="action.add-ticket.php" method="POST">

        <div class="card">
            <div class="card-header">
                <h5>Create custom ticket</h5>
            </div>
            <div class="card-body">
                <span class="text-form">Use this for special invites. Submitting this form will create a custom ticket for someone and optionally send them a link to pay for the ticket. You can also override the ticket price for this payment.</span>
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
                            <div class="input-group-addon">₱</div>
                            <input type="text" class="form-control" id="txt_price_per_ticket" name="price_per_ticket" placeholder="Price per ticket" value="<?=$event->ticket_price;?>" disabled>
                            <div class="input-group-btn"><button type="button" class="btn" onclick="enablePriceOverride();"><i class="fa fa-pencil"></i></div>
                        </div>
                </div>
                <div class="form-group">
                    <label for="txt_email_address">Referral code (optional)</label>
                    <input type="text" class="form-control" id="txt_referral_code" name="referral_code" placeholder="Referral code (optional)">
                </div>
                <div class="form-group">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" value="1" name="ticket_paid" id="checkbox_ticket_paid" onclick="onToggleMarkAsPaid();"><label class="form-check-label" for="checkbox_ticket_paid">Mark as paid</label>
                    </div>
                    <div class="form-group" id="div_payment_processing_fee" style="display:none;">
                        <label for="txt_payment_processing_fee">Payment Processing Fee</label>
                        <input type="text" class="form-control" id="txt_payment_processing_fee" name="payment_processing_fee" placeholder="Processing Fee" value="0">
                    </div>
                    <div class="form-check form-switch" id="div_send_payment_link">    
                        <input class="form-check-input" type="checkbox" value="1" name="send_email" id="checkbox_send_email"><label class="form-check-label" for="checkbox_send_email">Send payment email</label>    
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <input type="submit" class="btn btn-block" value="Add Ticket">
            </div>
        </div>
    </form>
    </div>
</div>
<script type="text/javascript" src="/assets/js/custom-sort-for-fancyTable.js"></script>
<script type="text/javascript">
$("#tblPendingOrders").fancyTable({
  sortColumn: 6, // column number for initial sorting
  sortOrder: 'descending', // 'desc', 'descending', 'asc', 'ascending', -1 (descending) and 1 (ascending)
  paginationClass:"btn-link",
  paginationClassActive:"active",
  pageClosest: 3,
  perPage: 15,
  sortable: true,
  pagination: true, // default: false
  searchable: true,
  globalSearch: true,
  inputStyle: "border: 1px solid lightgray; padding:10px; border-radius:5px; font-size: 14px;",
  sortFunction: customSort
});
</script>