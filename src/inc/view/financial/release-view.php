<?
    include_once('./inc/controller/get-recuperable-expense.php');
    include_once('./inc/controller/get-release-list.php');
    include_once('./inc/controller/get-royalties.php');
    include_once('./inc/controller/get-earnings.php');
    include_once('./inc/model/releaseartist.php');

    session_start();
    $releases = getReleaseListForArtist($_SESSION['current_artist']);
?>
<h3>Release Information</h3>
<p>This tab shows financial details regarding your release, including splits, recuperable expenses, earnings, and revenues.</p>
<div class="table-responsive">
    <table class="table">
        <thead>
            <tr><th>For Release</th>
            <th>Sync royalty %</th>
            <th>Streaming royalty %</th>
            <th>Downloads royalty %</th>
            <th>Physical royalty %</th>
            <th>Remaining Recuperable Expense</th>
            <th>Total earnings 
            <i class="fa fa-info-circle" data-toggle="tooltip" data-placement="top" title="Data starts on April 2021.">
            </th>
            <th>Total royalties earned</th>
        </thead>
        <tbody>
        <? if ($releases != null) {
                foreach($releases as $release) {
                    $recuperableExpense = getRecuperableExpenseBalance($release->id);
                    $royalties = getTotalRoyaltiesForArtistForRelease($_SESSION['current_artist'], $release->id);
                    $earnings = getTotalEarningsForRelease($release->id);
                    
                    $artistRelease = new ReleaseArtist;
                    $artistRelease->fromID($_SESSION['current_artist'], $release->id);
                    $sync_royalty = ($artistRelease->sync_royalty_percentage * 100) ."% of " . $artistRelease->sync_royalty_type;
                    $streaming_royalty = ($artistRelease->streaming_royalty_percentage * 100) ."% of " . $artistRelease->streaming_royalty_type;
                    $download_royalty = ($artistRelease->download_royalty_percentage * 100) ."% of " . $artistRelease->download_royalty_type;
                    $physical_royalty = ($artistRelease->physical_royalty_percentage * 100) ."% of " . $artistRelease->physical_royalty_type;
        ?>
            <tr>
                <td width="25%"><strong><?=$release->title;?></strong></td>
                <td><?=$sync_royalty;?></td>
                <td><?=$streaming_royalty;?></td>
                <td><?=$download_royalty;?></td>
                <td><?=$physical_royalty;?></td>
                <td align="right"><?=number_format($recuperableExpense, 2);?></td>
                <td align="right"><?=number_format($earnings, 2);?></td>
                <td align="right"><?=number_format($royalties, 2);?></td>
            </tr>
        <?
                    
                }
            } else {
        ?>
        No releases yet.
        <?
            }
        ?>
        </tbody>
    </table>
</div>