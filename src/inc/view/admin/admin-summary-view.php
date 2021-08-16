<?
    require_once('./inc/model/artist.php');
    require_once('./inc/controller/get-artist-list.php');
    require_once('./inc/controller/get-royalties.php');
    require_once('./inc/controller/get-earnings.php');

    $artists = getAllArtists();
    $overallTotalRoyalties = 0;
    $overallTotalEarnings = 0;
?>

<h3>Earnings and Royalties Summary</h3>
<div class="table-responsive">
    <table class="table">
        <thead>
            <tr><th>Artist</th>
            <th>Total earnings</th>
            <th>Total royalties</th>
        </thead>
        <tbody>
<? if ($artists) {
        foreach ($artists as $artist) { 
            $totalEarnings = getTotalEarningsForArtist($artist->id);
            $totalRoyalties = getTotalRoyaltiesForArtist($artist->id);

            $overallTotalEarnings += $totalEarnings;
            $overallTotalRoyalties += $totalRoyalties;
        ?>
            <tr>
                <td><?=$artist->name;?></td>
                <td style="text-align:right;">Php<?=number_format($totalEarnings,2);?></td>
                <td style="text-align:right;">Php<?=number_format($totalRoyalties,2);?></td>
            </tr>
<?      } 
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
                    <h4 class="title">Total Earnings</h4>
                </div>
                <div class="content">
                    <h5>Php <?=number_format($overallTotalEarnings,2);?></h5>
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
    </div
?>