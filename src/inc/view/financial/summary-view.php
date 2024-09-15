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
                <h4 class="title"><i class="fa fa-money header-icon"></i> <strong>Current Balance</strong></h4> 
            </div>
            <div class="card-body">
                Your current balance is <i class="fa fa-info-circle" data-toggle="tooltip" data-placement="top" title="This is what we owe you."></i><br>
                <h3><strong>P<?=number_format($currentBalance, 2);?></strong></h3>
                <? if ($isAdmin) { ?>
                <a data-toggle="tab" href="#new-payment">
                <button class="btn btn-primary btn-block" <?=$currentBalance <= 0 ? "disabled":"";?>><i class="fa fa-credit-card"></i> Pay Now</button>
                </a>
                <? } ?>
            </div>
        </div>
    </div>

    <div class="col-md-3">
        <div class="card">
            <div class="card-header">
                <h4 class="title"><i class="fa fa-dollar header-icon"></i> <strong>Total Earnings</strong></h4>
            </div>
            <div class="card-body">
               Your current total earnings* are
                <h5><strong>P<?=number_format($totalEarnings, 2);?></strong></h5>
                <em>* Starting April 2021</em><br>
            </div>
            <div class="card-footer">
                <a data-toggle="tab" href="#earnings">
                <button class="btn-link text-left" style="width:100%"><i class="fa fa-search-plus"></i>View earning details</button>
                </a>
            </div>
        </div>
    </div>

    <div class="col-md-3">
        <div class="card">
            <div class="card-header">
                <h4 class="title"><i class="fa fa-star header-icon"></i> <strong>Total Royalties</strong></h4>
            </div>
            <div class="card-body">
                Your current total royalties is <i class="fa fa-info-circle" data-toggle="tooltip" data-placement="top" title="These are the royalties you've earned from all merch, digital, and streaming sales."></i><br>
                <h5><strong>P<?=number_format($totalRoyalties, 2);?></strong></h5>
            </div>
            <div class="card-footer">
                <a data-toggle="tab" href="#royalties">
                <button class="btn-link text-left" style="width:100%"><i class="fa fa-search-plus"></i>View royalty details</button>
                </a>
            </div>
        </div>
    </div>

    <div class="col-md-3">
        <div class="card">
            <div class="card-header">
            
                <h4 class="title"><strong><i class="fa fa-credit-card header-icon"></i> Total Payments</strong></h4>
            </div>
            <div class="card-body">
                Your current total payments and advances is <i class="fa fa-info-circle" data-toggle="tooltip" data-placement="top" title="These are payments we've made to you in the form of royalty payouts, cash advances, and consigned merch sales."></i><br>
                <h5><strong>P<?=number_format($totalPayments, 2);?></strong></h5>
            </div>
            <div class="card-footer">
                <a data-toggle="tab" href="#payments">
                <button class="btn-link text-left" style="width:100%"><i class="fa fa-search-plus"></i>View payment details</button>
                </a>
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