<?
    include_once('./inc/controller/get_referrers.php');

    include_once('./inc/controller/brand_check.php');

    $event = new Event;
    $event->fromID($_SESSION['current_event']);

    $referrers = getReferrersForEvent($_SESSION['current_event']);
?>
<script type="text/javascript">
    function copyText(text) {
        navigator.clipboard.writeText(text);
    }

    function generateReferralCode() {
        var eventTitle = '<?=$event->title;?>';
        var referrerName = document.getElementById('referrer_name').value;
        var referralCode = eventTitle.replace(/[^A-Z0-9]/ig, "") + "-" + referrerName.replace(/[^A-Z0-9]/ig, "");
        document.getElementById('referral_code_text').value = referralCode;
    }

    function generateSlug() {
        var referralCode = document.getElementById('referral_code_text').value;
        var slug = "Buy" + referralCode.replace(/[^A-Z0-9]/ig, "");
        document.getElementById('slug').value = slug;
        
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
                <td style="text-align:right;"><?="₱ ". number_format($sales->gross_amount_sold,2); ?></td>
                <td style="text-align:right;"><?="₱ ". number_format($sales->net_amount_sold, 2); ?></td>
                <td><a href="javascript:copyText('<?=$referrer->referral_shortlink;?>');"><i class="fa fa-copy"></i></a></div></td>
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
    <div class="col-md-4">
        <form action="action.add-event-referrer.php" method="POST">
    
        <div class="card">
            <div class="card-header"><h4>Add referrer</h4></div>
            <div class="card-body">
                <input type="hidden" name="event_id" value="<?=$_SESSION['current_event'];?>">
                <input type="text" class="form-control" id="referrer_name" name="name" placeholder="Referrer name" onchange="generateReferralCode();">
                <input type="text" class="form-control" id="referral_code_text" name="referral_code" placeholder="Referral code" onchange="generateSlug();">
                <input type="text" class="form-control" id="slug" name="slug" placeholder="URL slug">
            </div>
            <div class="card-footer">
                <input type="submit" class="btn btn-block" value="Add Referrer">
            </div>
        </div>                 
        </form>
    </div>
</div>