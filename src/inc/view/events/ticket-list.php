<?
    include_once('./inc/controller/ticket-controller.php');

    include_once('./inc/controller/brand_check.php');
    include_once('./inc/model/eventreferrer.php');
    
    $tickets = getTicketsForEvent($_SESSION['current_event']);
    $count = 0;
    if ($tickets) {
        $total_sold = 0;
        $total_processing_fee = 0;
        foreach($tickets as $ticket) {
            if($ticket->status == 'Ticket sent.') $count += $ticket->number_of_entries;
            $total_processing_fee += (isset($ticket->payment_processing_fee) ? $ticket->payment_processing_fee : 0);
            $total_sold += ($ticket->status == 'Ticket sent.' || $ticket->status == 'Payment Confirmed') ? ($ticket->number_of_entries * $ticket->price_per_ticket) : 0;
        }
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
    function waitForFileSent() {
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
    <div class="col-md-4"><h3>Confirmed Orders</h3></div>
</div>
<div class="row">
    <div class="card">
        <div class="card-header">
            <div class="col-md-12">
                <div class="btn-toolbar" role="toolbar">
                    <div class="btn-group" role="group" aria-label="Actions">
                        <a onclick="waitForFileSent();" href="action.download-ticket-csv.php?id=<?=$_SESSION['current_event'];?>&token=<?=$downloadToken;?>">
                            <button type="button" class="btn-link">
                                <i class="fa fa-download"></i> Download CSV
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
                        <th>Claimed</th>
                        <th>Actions</th>
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
                        <tr<?=$ticket->number_of_claimed_entries == $ticket->number_of_entries ? ' class="text-muted"':"";?>>
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
                            <td><?=$ticket->number_of_claimed_entries . " / " . $ticket->number_of_entries;?></td>
                            <td>
                                <? if ($ticket->number_of_claimed_entries < $ticket->number_of_entries) { ?>
                                    <a href="action.send-tickets.php?ticket_id=<?=$ticket->id;?>">[ Resend Ticket ]</a>
                                <? } ?>
                            </td>
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
                <i class="fa fa-dot-circle-o" style="color:green;" title="Number of paid tickets"></i> <?=$count;?>&nbsp;&nbsp;
                <i class="fa fa-money" title="Total revenue"></i> ₱<?=number_format($total_sold,2);?>&nbsp;&nbsp;
                <i class="fa fa-credit-card" title="Total processing fee"></i> -<?=number_format($total_processing_fee,2);?>&nbsp;&nbsp;
                <i class="fa fa-plus-square" title="Net amount"></i> <strong>₱<?=number_format($total_sold - $total_processing_fee,2);?></strong>

        </div>
    </div>
</div>

<div class="row">
    <div class="alert alert-info">
    <h6>Want to invite someone?</h6>
    <p class="text-form">Click <a data-toggle="tab" href="#pending">here</a> to create a custom ticket.</p>
    </div>
</div>