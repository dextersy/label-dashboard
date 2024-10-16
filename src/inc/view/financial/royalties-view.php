<?
    include_once('./inc/controller/get-royalties.php');

    $royaltyViewItems = getRoyaltiesForArtist($_SESSION['current_artist']);

?>
<div class="card">
    <div class="card-header">
        <h4 class="title">Earned Royalties</h4>
    </div>

    <div class="card-body">
        <div class="table-responsive">
            <table class="table" id="tblRoyalties">
                <thead>
                    <tr><th>Date Recorded</th>
                    <th>For Release</th>
                    <th>Description</th>
                    <th style="text-align:right;" data-sortas="numeric">Amount</th>
                </thead>
                <tbody>
                <? if ($royaltyViewItems != null) {
                        foreach($royaltyViewItems as $royaltyViewItem) {
                ?>
                    <tr>
                        <td><?=$royaltyViewItem->date_recorded;?></td>
                        <td><?=$royaltyViewItem->release_title==''?"(None)":$royaltyViewItem->release_title;?></td>
                        <td><?=$royaltyViewItem->description;?></td>
                        <td style="text-align:right"><?=number_format($royaltyViewItem->amount, 2);?></td>
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
    </div>
</div>
<script type="text/javascript" src="/assets/js/custom-sort-for-fancyTable.js"></script>
<script type="text/javascript">
$("#tblRoyalties").fancyTable({
  sortColumn:0, // column number for initial sorting
  sortOrder: 'descending', // 'desc', 'descending', 'asc', 'ascending', -1 (descending) and 1 (ascending)
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