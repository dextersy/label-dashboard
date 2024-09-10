<?
    require_once('./inc/model/artist.php');
    require_once('./inc/controller/get-artist-list.php');
    require_once('./inc/controller/get-release-list.php');
    require_once('./inc/controller/get-royalties.php');
    require_once('./inc/controller/get-earnings.php');
    require_once('./inc/controller/payment-controller.php');
    require_once('./inc/controller/get-recuperable-expense.php');

    $artists = getAllArtists($_SESSION['brand_id']);
    $releases = getAllReleases($_SESSION['brand_id']);
    $overallTotalRoyalties = 0;
    $overallTotalPayments = 0;

    $overallTotalStreamingEarnings = 0;
    $overallTotalSyncEarnings = 0;
    $overallTotalDownloadEarnings = 0;
    $overallTotalPhysicalEarnings = 0;

    if(isset($_POST['daterange'])) {
        $tokens = explode(" - ", $_POST['daterange']);
        $startDateDisplay = $tokens[0];
        $endDateDisplay = $tokens[1];

        $startDateObj = DateTime::createFromFormat('m/d/Y', $startDateDisplay);
        $endDateObj = DateTime::createFromFormat('m/d/Y', $endDateDisplay);

        $startDate = $startDateObj->format('Y-m-d');
        $endDate = $endDateObj->format('Y-m-d');
    }
    else {
        
        $startDate = date("Y-m-d", strtotime('-30 days'));
        $endDate = date("Y-m-d");

        $startDateObj = DateTime::createFromFormat('Y-m-d', $startDate);
        $endDateObj = DateTime::createFromFormat('Y-m-d', $endDate);

        $startDateDisplay = $startDateObj->format('m/d/Y');
        $endDateDisplay = $endDateObj->format('m/d/Y');
    }
?>

<script type="text/javascript" src="https://cdn.jsdelivr.net/jquery/latest/jquery.min.js"></script>
<script type="text/javascript" src="https://cdn.jsdelivr.net/momentjs/latest/moment.min.js"></script>
<script type="text/javascript" src="https://cdn.jsdelivr.net/npm/daterangepicker/daterangepicker.min.js" defer></script>
<link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/daterangepicker/daterangepicker.css" />

<script type="text/javascript">
    $(function() {
        $('#datepicker_dateRange').daterangepicker({
            ranges: {
                'Today': [moment(), moment()],
                'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
                'Last 7 Days': [moment().subtract(6, 'days'), moment()],
                'Last 30 Days': [moment().subtract(29, 'days'), moment()],
                'This Month': [moment().startOf('month'), moment().endOf('month')],
                'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
            }
        }); 
    });
</script>


<div class="row" style="padding-top:10px;">
    <div class="col-md-3">
        <form action="admin.php#summary" method="POST">
        <div class="form-group">
            <label for="datepicker_dateRange">Select date range</label>
            <div class="input-group">
                <input type="text" class="form-control" id="datepicker_dateRange" name="daterange" value="<?=$startDateDisplay;?> - <?=$endDateDisplay;?>" />
                <div class="input-group-addon">
                    <button class="btn-link" type="submit"><i class="fa fa-filter"></i></button>
                </div>
            </div>
        </div>
        </form>
    </div>
</div>
<h3>Earnings Summary</h3>
<? if ($releases) {
    foreach ($releases as $release) {
        $totalEarnings = getTotalEarningsForRelease($release->id, $startDate, $endDate, "Streaming");
        $overallTotalStreamingEarnings += $totalEarnings;

        $totalEarnings = getTotalEarningsForRelease($release->id, $startDate, $endDate, "Sync");
        $overallTotalSyncEarnings += $totalEarnings;

        $totalEarnings = getTotalEarningsForRelease($release->id, $startDate, $endDate, "Downloads");
        $overallTotalDownloadEarnings += $totalEarnings;

        $totalEarnings = getTotalEarningsForRelease($release->id, $startDate, $endDate, "Physical");
        $overallTotalPhysicalEarnings += $totalEarnings;
    } 
?>
<div class="row">
    <div class="col-md-3">
        <div class="card">
            <div class="card-header">
                <h4 class="title"><i class="fa fa-shopping-bag header-icon"></i> Physical Earnings</h4>
            </div>
            <div class="card-body">
            <div class="card-text">
                <h5>Php <?=number_format($overallTotalPhysicalEarnings,2);?></h5>
            </div>
            </div>
        </div>
    </div>
    <div class="col-md-3">
        <div class="card">

            <div class="card-header">
                <h4 class="title"><i class="fa fa-download header-icon"></i> Download Earnings</h4>
            </div>
            <div class="card-body">
            <div class="card-text">
                <h5>Php <?=number_format($overallTotalDownloadEarnings,2);?></h5>
            </div>
            </div>
        </div>
    </div>
    <div class="col-md-3">
        <div class="card">

            <div class="card-header">
                <h4 class="title"><i class="fa fa-headphones header-icon"></i>
                 Streaming Earnings</h4>
            </div>
            <div class="card-body">
            <div class="card-text">
                <h5>Php <?=number_format($overallTotalStreamingEarnings,2);?></h5>
            </div>
            </div>
        </div>
    </div>
    <div class="col-md-3">
        <div class="card">

            <div class="card-header">
                <h4 class="title"><i class="fa fa-television header-icon"></i>
                 Sync Earnings</h4>
            </div>
            <div class="card-body">
            <div class="card-text">
                <h5>Php <?=number_format($overallTotalSyncEarnings,2);?></h5>
            </div>
            </div>
        </div>
    </div>
</div>
<? } else { ?>
    No releases yet.
<? } ?>

<h3>Payments and Royalties Summary</h3>
<div class="col-md-6">
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
</div>
<div class="col-md-6">
    <div class="row">
            <div class="card">

                <div class="card-header">
                    <h4 class="title">Total Payments</h4>
                </div>
                <div class="card-body">
                    <h5>Php <?=number_format($overallTotalPayments,2);?></h5>
                </div>
            </div>
            <div class="card">

                <div class="card-header">
                    <h4 class="title">Total Royalties</h4>
                </div>
                <div class="card-body">
                    <h5>Php <?=number_format($overallTotalRoyalties,2);?></h5>
                </div>
            </div>
            <div class="card">

                <div class="card-header">
                    <h4 class="title">Total New Recuperable Expense</h4>
                </div>
                <div class="card-body">
                    <h5>Php <?=number_format(getTotalNewRecuperableExpenseForPeriod($startDate, $endDate, $_SESSION['brand_id']),2);?></h5>
                </div>
            </div>
           <div class="card">

                <div class="card-header">
                    <h4 class="title">Total Recuperated Expenses</h4>
                </div>
                <div class="card-body">
                    <h5>Php <?=number_format(abs(getTotalRecuperatedExpenseForPeriod($startDate, $endDate, $_SESSION['brand_id'])),2);?></h5>
                </div>
            </div>
    </div>
</div>
