<?
    include_once('./inc/controller/get_referrers.php');

    include_once('./inc/controller/brand_check.php');

    $referrers = getReferrersForEvent($_SESSION['current_event']);
    $referral_link_prefix = "https://" . $_SERVER['SERVER_NAME'] . "/public/tickets/buy.php?id=" . $event->id . "&ref=";
?>
<script type="text/javascript">
    function copyReferralLink(code) {
        navigator.clipboard.writeText('<?=$referral_link_prefix;?>'+code);
    }
</script>
<div class="row">
    <div class="col-md-6"><h3>Referrers</h3></div>
</div>
<div class="table-responsive">
    <table class="table">
        <thead>
            <tr><th>Name</th>
            <th>Referral code</th>
            <th>Tickets sold</th>
            <th style="text-align:right;">Gross sales</th>
            <th style="text-align:right;">Net sales</th>
            <th>Referral link</th>
        </thead>
        <tbody>
<?
    if ($referrers) {
        foreach($referrers as $referrer) {
            $sales = getReferrerSales($referrer->id);
?>
            <tr>
                <td><?=$referrer->name; ?></td>
                <td><?=$referrer->referral_code; ?></td>
                <td><?=$sales->tickets_sold; ?></td>
                <td style="text-align:right;"><?="Php ". number_format($sales->gross_amount_sold,2); ?></td>
                <td style="text-align:right;"><?="Php ". number_format($sales->net_amount_sold, 2); ?></td>
                <td><a href="javascript:copyReferralLink('<?=$referrer->referral_code;?>');"><i class="fa fa-copy"></i></a></div></td>
            </tr>
<?      }
    } else {
?>
    No referrers yet.
<?
    } 
?>
        </tbody>
    </table>
</div>
<div class="row">
    <div class="col-md-6">
        <h4>Add referrer</h4>
        <form action="action.add-event-referrer.php" method="POST">
        <div class="form-group">
            <input type="hidden" name="event_id" value="<?=$_SESSION['current_event'];?>">
            <input type="text" class="form-control" id="name" name="name" placeholder="Referrer name">
            <input type="text" class="form-control" id="referral_code" name="referral_code" placeholder="Referral code">
            <input type="submit" class="btn btn-primary" value="Add Referrer">
        </div>                 
        </form>
    </div>
</div>