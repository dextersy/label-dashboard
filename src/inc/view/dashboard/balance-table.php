<?
    session_start();
    include_once('./inc/controller/page-check.php');
    include_once('./inc/controller/get-artist-list.php');
    include_once('./inc/controller/get-royalties.php');
    include_once('./inc/controller/payment-controller.php');

    if ($isAdmin) {
        $artists = getAllArtists($_SESSION['brand_id'], 5);
    }
    else {
        $artists = getArtistListForUser($_SESSION['logged_in_user']);
    }
?>
<div class="col-md-4">
<div class="card">
    <div class="card-header"><h5>Balance Summary</h5></div>
    <div class="card-body">
        <div class="table-responsive">
        <table class="table">
            <thead>
                <tr><th>Artist</th>
                <th>Current balance</th>
            </thead>
            <tbody>
    <? 
        if ($artists) {
            foreach ($artists as $artist) {
                $balance = getTotalRoyaltiesForArtist($artist->id) - getTotalPaymentsForArtist($artist->id); 
    ?>
                <tr>
                    <td><?=$artist->name;?></td>
                    <td class="text-right" style="font-weight:bold;">₱<?=number_format($balance, 2);?></td>
                </tr>
    <?      }
        }
    ?>
            </tbody>
        </table>
        </div>
    </div>
    <div class="card-footer text-right">
        <a href="financial.php">Go to financial overview <i class="fa fa-arrow-circle-o-right"></i></a>
    </div>
</div>
</div>