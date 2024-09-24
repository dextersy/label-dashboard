<?
    require_once('./inc/model/artist.php');
    require_once('./inc/controller/get-artist-list.php');
    require_once('./inc/controller/get-royalties.php');
    require_once('./inc/controller/payment-controller.php');

    require_once('./inc/model/release.php');
    require_once('./inc/controller/get-release-list.php');
    require_once('./inc/controller/get-recuperable-expense.php');

    $artists = getAllArtists($_SESSION['brand_id']);
    $releases = getAllReleases($_SESSION['brand_id']);

    $currentBalance = getWalletBalance($_SESSION['brand_id']);
?>
<h3>Balance Summary</h3>
<div class="table-responsive">
    <table class="table">
        <thead>
            <tr><th>Artist</th>
            <th style="text-align:right;">Total royalties</th>
            <th style="text-align:right;">Total payments</th>
            <th style="text-align:right;">Total balance</th>
            <th style="text-align:right;">Payout point</th>
            <th style="text-align:right;">Due for payment</th>
        </thead>
        <tbody>
<? 
    if ($artists) {
        $overallDueForPayment = 0;
        $overallBalance = 0;
        $readyForPayment = 0;
        foreach ($artists as $artist) { 
            $totalRoyalties = getTotalRoyaltiesForArtist($artist->id);
            $totalPayments = getTotalPaymentsForArtist($artist->id);
            $totalBalance = $totalRoyalties - $totalPayments;
            if ($totalBalance != 0) {
                $overallBalance += $totalBalance;

                if($totalBalance > $artist->payout_point) {
                    $overallDueForPayment += $totalBalance;

                    $paymentMethodsForArtist = getPaymentMethodsForArtist($artist->id);
                    if(isset($paymentMethodsForArtist) && count($paymentMethodsForArtist) > 0) {
                        $readyForPayment += $totalBalance;
                    }
                }
        ?>
            <tr>
                <td><?=$artist->name;?></td>
                <td style="text-align:right;">₱<?=number_format($totalRoyalties,2);?></td>
                <td style="text-align:right;">₱<?=number_format($totalPayments,2);?></td>
                <td style="text-align:right;"><strong>₱<?=number_format($totalBalance,2);?></strong></td>
                <td style="text-align:right;">₱<?=number_format($artist->payout_point,0);?></td>
                <td style="text-align:right;"><?=($totalBalance > $artist->payout_point)?"✓":"";?></td>

            </tr>
<?          }
         } 
    } else { ?>
    No releases yet.
<?  } ?>
        </tbody>
    </table>
    </div>
    <div class="row">
        <div class="col-md-4">
            <div class="card">

                <div class="card-header">
                    <h4 class="title">Total Balance</h4>
                </div>
                <div class="card-body">
                    <h3>₱ <?=number_format($overallBalance,2);?></h3>
                </div>
            </div>
        </div>

        <div class="col-md-4">
            <div class="card">

                <div class="card-header">
                    <h4 class="title">Total Due For Payment</h4>
                </div>
                <div class="card-body">
                    <h3>₱ <?=number_format($overallDueForPayment,2);?></h3>
                </div>
            </div>
        </div>

        <div class="col-md-4">
            <div class="card">

                <div class="card-header">
                    <h4 class="title">Ready to Pay <i class="fa fa-info-circle" title="Due for payment and has bank account"></i></h4>
                </div>
                <div class="card-body">
                    <h3>₱ <?=number_format($readyForPayment,2);?></h3>
                    <button class="btn btn-block" disabled><i class="fa fa-credit-card"></i> Pay Now</button>
                </div>
                <div class="card-footer">
                    <div class="badge badge-pill badge-info align-self-center" id="div_availableBalance">
                        Available balance: ₱ <?=number_format($currentBalance, 2);?>
                    </div>
                </div>
            </div>
        </div>
    </div>

<h3>Recuperable Expenses</h3>
<div class="row">
    <div class="col-md-5">
    <div class="table-responsive">
        <table class="table">
            <thead>
                <tr><th>Release</th>
                <th style="text-align:right;">Remaining Recuperable Expense</th>
            </thead>
            <tbody>
<? if ($releases) {
        $overallTotalRecuperableExpense = 0;
        foreach ($releases as $release) { 
            $recuperableExpense = getRecuperableExpenseBalance($release->id);
            
            if ($recuperableExpense != 0) {
                $overallTotalRecuperableExpense += $recuperableExpense;
        ?>
            <tr>
                <td><?=$release->catalog_no;?>: <?=$release->title;?></td>
                <td style="text-align:right;">₱<?=number_format($recuperableExpense,2);?></td>
            </tr>
<?          }
         } 
    } else { ?>
    No releases yet.
<?  } ?>
            </tbody>
        </table>
        </div>
    </div>
    </div>
    <div class="row">
        <div class="col-md-4">
            <div class="card">

                <div class="card-header">
                    <h4 class="title">Total Recuperable Expense</h4>
                </div>
                <div class="card-body">
                    <h3>₱ <?=number_format($overallTotalRecuperableExpense,2);?></h3>
                </div>
            </div>
        </div>
    </div>