<? 
    include_once('./inc/controller/get-earnings.php'); 
    include_once('./inc/controller/get-royalties.php'); 
    include_once('./inc/controller/payment-controller.php'); 

    session_start();
    $totalRoyalties = getTotalRoyaltiesForArtist($_SESSION['current_artist']);
    $totalPayments = getTotalPaymentsForArtist($_SESSION['current_artist']);
    $totalEarnings = getTotalEarningsForArtist($_SESSION['current_artist']);
    $currentBalance = $totalRoyalties - $totalPayments;
?>
<h3>Summary</h3>
<div class="row">
    <div class="col-md-3">
        <div class="card">

            <div class="card-header">
            <i class="fa fa-balance-scale header-icon"></i>
                <h4 class="title"><strong>Current Balance</strong></h4> 
            </div>
            <div class="card-body">
                Your current balance is <i class="fa fa-info-circle" data-toggle="tooltip" data-placement="top" title="This is what we owe you."></i><br>
                <h3><strong>P<?=number_format($currentBalance, 2);?></strong></h3>
                <? if ($isAdmin) { ?>
                <a data-toggle="tab" href="#new-payment">
                <button class="btn" style="width:100%" <?=$currentBalance <= 0 ? "disabled":"";?>><i class="fa fa-credit-card"></i> Pay Now</button>
                </a>
                <? } ?>
            </div>
        </div>
    </div>

    <div class="col-md-3">
        <div class="card">
            <div class="card-header">
            <i class="fa fa-dollar header-icon"></i>
                <h4 class="title">                    
                    <strong>Total Earnings</strong></h4>
            </div>
            <div class="card-body">
               Your current total earnings* are
                <h5><strong>P<?=number_format($totalEarnings, 2);?></strong></h5>
                <em>* Starting April 2021</em>
                <p><a data-toggle="tab" href="#earnings">View earning details</a></p>
            </div>
        </div>
    </div>

    <div class="col-md-3">
        <div class="card">
            <div class="card-header">
                <i class="fa fa-star header-icon"></i>
                <h4 class="title"><strong>Total Royalties</strong></h4>
            </div>
            <div class="card-body">
                Your current total royalties is <i class="fa fa-info-circle" data-toggle="tooltip" data-placement="top" title="These are the royalties you've earned from all merch, digital, and streaming sales."></i><br>
                <h5><strong>P<?=number_format($totalRoyalties, 2);?></strong></h5>
                <p><a data-toggle="tab" href="#royalties">View royalty details</a></p>
            </div>
        </div>
    </div>

    <div class="col-md-3">
        <div class="card">
            <div class="card-header">
            <i class="fa fa-credit-card header-icon"></i>
                <h4 class="title"><strong>Total Payments</strong></h4>
            </div>
            <div class="card-body">
                Your current total payments and advances is <i class="fa fa-info-circle" data-toggle="tooltip" data-placement="top" title="These are payments we've made to you in the form of royalty payouts, cash advances, and consigned merch sales."></i><br>
                <h5><strong>P<?=number_format($totalPayments, 2);?></strong></h5>
                <p><a data-toggle="tab" href="#payments">View payment details</a></p>
            </div>
        </div>
    </div>
</div>

<div class="row">
    <div class="col-md-6">
        <div class="card">

            <div class="card-header">
                <h4 class="title"><strong>Latest Earnings</strong></h4>
            </div>
            <div class="card-body">
                <? include_once('./inc/view/financial/earnings-table.php'); ?>
            </div>
        </div>
    </div>

    <div class="col-md-6">
        <div class="card">
            <div class="card-header">
                <h4 class="title"><strong>Latest Royalties</strong></h4>
            </div>
            <div class="card-body">
            <? include_once('./inc/view/financial/royalties-table.php'); ?>
            </div>
        </div>
    </div>
</div>