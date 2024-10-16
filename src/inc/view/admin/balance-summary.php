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
    <table class="table" id="tblBalanceSummary">
        <thead>
            <tr><th>Artist</th>
            <th style="text-align:right;" data-sortas="numeric">Total royalties (₱)</th>
            <th style="text-align:right;" data-sortas="numeric">Total payments (₱)</th>
            <th style="text-align:right;" data-sortas="numeric">Total balance (₱)</th>
            <th style="text-align:right;" data-sortas="numeric">Payout point (₱)</th>
            <th style="text-align:center;">Due for payment</th>
            <th style="text-align:center;">Payouts paused</th>
        </thead>
        <tbody>
<? 
    $displayPayoutList = "";

    if ($artists) {
        $overallDueForPayment = 0;
        $overallBalance = 0;
        $readyForPayment = 0;
        $pausedPayouts = 0;
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
                        if($artist->hold_payouts) { $pausedPayouts += $totalBalance; }
                        else { 
                            $readyForPayment += $totalBalance;
                            $displayPayoutList = $displayPayoutList . "<li> " . $artist->name . " : " . number_format($totalBalance, 2) . "</li>"; 
                        }
                    }
                }
        ?>
            <tr>
                <td><?=$artist->name;?></td>
                <td style="text-align:right;"><?=number_format($totalRoyalties,2);?></td>
                <td style="text-align:right;"><?=number_format($totalPayments,2);?></td>
                <td style="text-align:right; font-weight:bold;"><?=number_format($totalBalance,2);?></td>
                <td style="text-align:right;"><?=number_format($artist->payout_point,0);?></td>
                <td class="text-center"><?=($totalBalance > $artist->payout_point)?"✓":"";?></td>
                <td class="text-center"><?=($artist->hold_payouts)?"<i class=\"fa fa-pause-circle-o\"></i>":"";?></td>
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
                <div class="card-body text-center">
                    <h3><strong>₱ <?=number_format($overallBalance,2);?></strong></h3>
                </div>
            </div>
        </div>

        <div class="col-md-4">
            <div class="card">

                <div class="card-header">
                    <h4 class="title">Total Due For Payment</h4>
                </div>
                <div class="card-body text-center">
                    <h3><strong>₱ <?=number_format($overallDueForPayment,2);?></strong></h3>
                </div>
            </div>
        </div>

        <div class="col-md-4">
            <div class="card">

                <div class="card-header">
                    <h4 class="title">Ready to Pay <i class="fa fa-info-circle" title="Due for payment and has bank account"></i></h4>
                </div>
                <div class="card-body text-center">
                    <h3><strong>₱ <?=number_format($readyForPayment,2);?></strong></h3>
                    <button id="btnPayAll" class="btn btn-primary btn-block"<?=($readyForPayment>0 && $currentBalance >= $readyForPayment) ? "" : " disabled";?>><i class="fa fa-credit-card"></i> Pay Now</button>
                    <small><strong>On hold:</strong> ₱ <?=number_format($pausedPayouts,2);?></small>
                </div>
                <div class="card-footer text-center">
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
        <table class="table" id="tblRecuperableExpense">
            <thead>
                <tr><th>Release</th>
                <th style="text-align:right;" data-sortas="numeric">Remaining Recuperable Expense (₱)</th>
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
                <td style="text-align:right;"><?=number_format($recuperableExpense,2);?></td>
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
                <div class="card-body text-center">
                    <h3><strong>₱ <?=number_format($overallTotalRecuperableExpense,2);?></strong></h3>
                </div>
            </div>
        </div>
    </div>

<!--- Confirm pay all dialog -->
<div class="modal" id="confirm-payAll" role="dialog" aria-labelledby="confirmPayAllLabel" aria-hidden="true" data-backdrop="true">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h4 class="title">Confirm payment</h4>
            </div>
            <div class="modal-body">
                Are you sure you want to pay the following balances?<br>
                <ul>
                    <?=$displayPayoutList;?>
                </ul>
            </div>
            <div class="modal-footer">
                <a href="/action.pay-all-balances.php" id="submit" class="btn btn-primary">Yes</a>
                <button id="btnCancelPayAll" type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
            </div>
        </div>
    </div>
</div>

<!-- FancyTable -->
<script src="/assets/js/jquery.3.2.1.min.js"></script>
<script src="/assets/js/fancyTable.min.js"></script>
<script type="text/javascript">
$('#btnPayAll').on("click", function() {
    $('#confirm-payAll').show();
});
$('#btnCancelPayAll').on("click", function() {
    $('#confirm-payAll').hide();
})
</script>

<script type="text/javascript" src="/assets/js/custom-sort-for-fancyTable.js"></script>
<script type="text/javascript">
$("#tblBalanceSummary").fancyTable({
  sortColumn:0, // column number for initial sorting
  sortOrder: 'ascending', // 'desc', 'descending', 'asc', 'ascending', -1 (descending) and 1 (ascending)
  paginationClass:"btn-link",
  paginationClassActive:"active",
  pageClosest: 3,
  perPage: 10,
  sortable: true,
  pagination: true, // default: false
  searchable: true,
  globalSearch: true,
  inputStyle: "border: 1px solid lightgray; padding:10px; border-radius:5px; font-size: 14px;",
  sortFunction: customSort
});

$("#tblRecuperableExpense").fancyTable({
  sortColumn:0, // column number for initial sorting
  sortOrder: 'ascending', // 'desc', 'descending', 'asc', 'ascending', -1 (descending) and 1 (ascending)
  paginationClass:"btn-link",
  paginationClassActive:"active",
  pageClosest: 3,
  perPage: 10,
  sortable: true,
  pagination: true, // default: false
  searchable: true,
  globalSearch: true,
  inputStyle: "border: 1px solid lightgray; padding:10px; border-radius:5px; font-size: 14px;",
  sortFunction: customSort
});
</script>