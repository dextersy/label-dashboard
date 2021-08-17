<?
    require_once('./inc/model/artist.php');
    require_once('./inc/controller/get-artist-list.php');
    require_once('./inc/controller/get-royalties.php');
    require_once('./inc/controller/get-payments.php');

    require_once('./inc/model/release.php');
    require_once('./inc/controller/get-release-list.php');
    require_once('./inc/controller/get-recuperable-expense.php');

    $artists = getAllArtists();
    $releases = getAllReleases();
?>
<h3>Balance Summary</h3>
<div class="table-responsive">
    <table class="table">
        <thead>
            <tr><th>Artist</th>
            <th style="text-align:right;">Total royalties</th>
            <th style="text-align:right;">Total payments</th>
            <th style="text-align:right;">Total balance</th>
        </thead>
        <tbody>
<? 
    if ($artists) {
        $overallTotalPayables = 0;
        foreach ($artists as $artist) { 
            $totalRoyalties = getTotalRoyaltiesForArtist($artist->id);
            $totalPayments = getTotalPaymentsForArtist($artist->id);
            $totalBalance = $totalRoyalties - $totalPayments;
            if ($totalBalance >0) {
                $overallTotalPayables += $totalBalance;
        ?>
            <tr>
                <td><?=$artist->name;?></td>
                <td style="text-align:right;">Php<?=number_format($totalRoyalties,2);?></td>
                <td style="text-align:right;">Php<?=number_format($totalPayments,2);?></td>
                <td style="text-align:right;"><strong>Php<?=number_format($totalBalance,2);?></strong></td>
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

                <div class="header">
                    <h4 class="title">Total Balance</h4>
                </div>
                <div class="content">
                    <h3>Php <?=number_format($overallTotalPayables,2);?></h3>
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
            
            if ($recuperableExpense >0) {
                $overallTotalRecuperableExpense += $recuperableExpense;
        ?>
            <tr>
                <td><?=$release->catalog_no;?>: <?=$release->title;?></td>
                <td style="text-align:right;">Php<?=number_format($recuperableExpense,2);?></td>
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

                <div class="header">
                    <h4 class="title">Total Recuperable Expense</h4>
                </div>
                <div class="content">
                    <h3>Php <?=number_format($overallTotalRecuperableExpense,2);?></h3>
                </div>
            </div>
        </div>
    </div>