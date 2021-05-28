<? 

    include_once('./inc/controller/get-royalties.php'); 
    include_once('./inc/controller/get-payments.php'); 

    session_start();
    $totalRoyalties = getTotalRoyaltiesForArtist($_SESSION['current_artist']);
    $totalPayments = getTotalPaymentsForArtist($_SESSION['current_artist']);
    $currentBalance = $totalRoyalties - $totalPayments;
?>
<h3>Summary</h3>
<div class="row">
    <div class="col-md-3">
        <div class="card">

            <div class="header">
                <h4 class="title"><strong>Current Balance</strong></h4>
            </div>
            <div class="content">
                Your current balance is <br>
                <h5><strong>P<?=number_format($currentBalance, 2);?></strong></h5><br>
            </div>
        </div>
    </div>

    <div class="col-md-3">
        <div class="card">
            <div class="header">
                <h4 class="title"><strong>Total Earnings</strong></h4>
            </div>
            <div class="content">
               <br>
                <h5><strong>COMING SOON.</strong></h5>
            </div>
        </div>
    </div>

    <div class="col-md-3">
        <div class="card">
            <div class="header">
                <h4 class="title"><strong>Total Royalties</strong></h4>
            </div>
            <div class="content">
                Your current total payments and advances is <br>
                <h5><strong>P<?=number_format($totalRoyalties, 2);?></strong></h5>
                <p><a data-toggle="tab" href="#royalties">View royalty details</a></p>
            </div>
        </div>
    </div>

    <div class="col-md-3">
        <div class="card">
            <div class="header">
                <h4 class="title"><strong>Total Payments</strong></h4>
            </div>
            <div class="content">
                Your current total payments and advances is <br>
                <h5><strong>P<?=number_format($totalPayments, 2);?></strong></h5>
                <p><a data-toggle="tab" href="#payments">View payment details</a></p>
            </div>
        </div>
    </div>
</div>

<div class="row">
    <div class="col-md-6">
        <div class="card">

            <div class="header">
                <h4 class="title"><strong>Latest Earnings</strong></h4>
            </div>
            <div class="content">
                <? include_once('./inc/view/financial/earnings-table.php'); ?>
            </div>
        </div>
    </div>

    <div class="col-md-6">
        <div class="card">
            <div class="header">
                <h4 class="title"><strong>Latest Royalties</strong></h4>
            </div>
            <div class="content">
            <? include_once('./inc/view/financial/royalties-table.php'); ?>
            </div>
        </div>
    </div>
</div>