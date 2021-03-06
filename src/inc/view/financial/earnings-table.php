<?
    include_once('./inc/controller/get-earnings.php');

    $earningViewItems = getEarningsForArtist($_SESSION['current_artist'], 0, 5); // First five items
?>
<div class="table-responsive">
    <table class="table">
        <thead>
            <tr><th>Date Recorded</th>
            <th>For Release</th>
            <th style="text-align:right">Amount</th>
        </thead>
        <tbody>
        <? if ($earningViewItems != null) {
                foreach($earningViewItems as $earningViewItem) {
        ?>
            <tr>
                <td><?=$earningViewItem->date_recorded;?></td>
                <td><?=$earningViewItem->release_title==''?"(None)":$earningViewItem->release_title;?></td>
                <td align="right"><?=number_format($earningViewItem->amount, 2);?></td>
            </tr>
        <?
                }
            } else {
        ?>
        No recorded royalties yet.
        <?
            }
        ?>
        </tbody>
    </table>
</div>