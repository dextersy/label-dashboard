<?
    include_once('./inc/controller/get-royalties.php');

    $royaltyViewItems = getRoyaltiesForArtist($_SESSION['current_artist'], 0, 5); // First five items
?>
<div class="table-responsive">
    <table class="table">
        <thead>
            <tr><th>Date Recorded</th>
            <th>For Release</th>
            <th style="text-align:right">Amount</th>
        </thead>
        <tbody>
        <? if ($royaltyViewItems != null) {
                foreach($royaltyViewItems as $royaltyViewItem) {
        ?>
            <tr>
                <td><?=$royaltyViewItem->date_recorded;?></td>
                <td><?=$royaltyViewItem->release_title==''?"(None)":$royaltyViewItem->release_title;?></td>
                <td align="right"><?=number_format($royaltyViewItem->amount, 2);?></td>
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