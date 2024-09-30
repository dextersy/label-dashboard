<?
    session_start();
    include_once('./inc/controller/page-check.php');
    include_once('./inc/controller/get-artist-list.php');
    include_once('./inc/controller/get-release-list.php');

    $RELEASE_LIMIT = 5;
    if ($isAdmin) {
        $releases = getReleaseEarningsListForAdmin($_SESSION['brand_id'], $RELEASE_LIMIT);
    }
    else {
        $releases = getReleaseEarningsListForUser($_SESSION['logged_in_user'], $RELEASE_LIMIT);
    }
?>
<div class="card">
    <div class="card-header"><h5>Top earning releases (all-time)</h5></div>
    <div class="card-body">
        <div class="table-responsive">
        <table class="table">
            <thead>
                <tr><th>Catalog Number</th>
                <th>Artist</th>
                <th>Title</th>
                <th>Total earnings</th>
            </thead>
            <tbody>
    <? 
        if ($releases) {
            foreach ($releases as $release) { 
    ?>
                <tr>
                    <td><?=$release->catalog_no;?></td>
                    <td><?=$release->artist_name;?></td>
                    <td><?=$release->title;?></td>
                    <td class="text-right">₱<?=number_format($release->total_earnings, 2);?></td>
                </tr>
    <?      }
        }
    ?>
            </tbody>
        </table>
        </div>
    </div>
    <div class="card-footer text-right">
        <a href="financial.php#release">Go to release earnings <i class="fa fa-arrow-circle-o-right"></i></a>
    </div>
</div>
