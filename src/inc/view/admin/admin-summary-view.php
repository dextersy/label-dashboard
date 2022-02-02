<?
    require_once('./inc/model/artist.php');
    require_once('./inc/controller/get-artist-list.php');
    require_once('./inc/controller/get-release-list.php');
    require_once('./inc/controller/get-royalties.php');
    require_once('./inc/controller/get-earnings.php');
    require_once('./inc/controller/get-payments.php');

    $artists = getAllArtists($_SESSION['brand_id']);
    $releases = getAllReleases($_SESSION['brand_id']);
    $overallTotalRoyalties = 0;
    $overallTotalEarnings = 0;
    $overallTotalPayments = 0;

    if(isset($_POST['date_from']) && isset($_POST['date_to'])) {
        $startDate = $_POST['date_from'];
        $endDate = $_POST['date_to'];
    }
    else {
        $startDate = date("Y-m-d", strtotime('-30 days'));
        $endDate = date("Y-m-d");
    }
?>
<div class="row" style="padding-top:10px;">
    <div class="col-md-4">
    <div class='picker'>
        <form action="admin.php" method="POST">
            <label for="fromperiod">From</label>
            <input type="date" id="fromperiod" name="date_from" value="<?=$startDate;?>">
            <label for="toperiod">to</label>
            <input type="date" id="toperiod" name="date_to" value="<?=$endDate;?>">
            <button class="btn btn-default" type="submit">Filter</button>
        </form>
    </div>
</div>
</div>
<h3>Earnings Summary</h3>
<? if ($releases) {
    foreach ($releases as $release) {
        $totalEarnings = getTotalEarningsForRelease($release->id, $startDate, $endDate);
        $overallTotalEarnings += $totalEarnings;
    } 
?>
<div class="row">
    <div class="col-md-4">
        <div class="card">

            <div class="header">
                <h4 class="title">Total Earnings</h4>
            </div>
            <div class="content">
                <h5>Php <?=number_format($overallTotalEarnings,2);?></h5>
            </div>
        </div>
    </div>
</div>
<? } else { ?>
    No releases yet.
<? } ?>

<h3>Payments and Royalties Summary</h3>

<div class="table-responsive">
    <table class="table">
        <thead>
            <tr><th>Artist</th>
            <th>Total payments</th>
            <th>Total royalties</th>
        </thead>
        <tbody>
<? if ($artists) {
        foreach ($artists as $artist) { 
            // @TODO Total earnings is not suitably calculated - earnings will add up double for each artist involved in the release
            $totalPayments = getTotalPaymentsForArtist($artist->id, $startDate, $endDate);
            $totalRoyalties = getTotalRoyaltiesForArtist($artist->id, $startDate, $endDate);

            if ($totalPayments >0 || $totalRoyalties >0) {
                $overallTotalPayments += $totalPayments;
                $overallTotalRoyalties += $totalRoyalties;
        ?>
            <tr>
                <td><?=$artist->name;?></td>
                <td style="text-align:right;">Php<?=number_format($totalPayments,2);?></td>
                <td style="text-align:right;">Php<?=number_format($totalRoyalties,2);?></td>
            </tr>
<?          }
         } 
    } else { ?>
    No artists yet.
<?  } ?>
    </tbody>
    </table>
    </div>
    <div class="row">
        <div class="col-md-4">
            <div class="card">

                <div class="header">
                    <h4 class="title">Total Payments</h4>
                </div>
                <div class="content">
                    <h5>Php <?=number_format($overallTotalPayments,2);?></h5>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card">

                <div class="header">
                    <h4 class="title">Total Royalties</h4>
                </div>
                <div class="content">
                    <h5>Php <?=number_format($overallTotalRoyalties,2);?></h5>
                </div>
            </div>
        </div>
    </div>
