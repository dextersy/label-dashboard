<?
    include_once('./inc/controller/get-earnings.php');

    $earningViewItems = getEarningsForArtist($_SESSION['current_artist']);

?>
<div class="card">
    <div class="card-header">
        <h4 class="title">Earnings for Releases</h4>
    </div>

    <div class="card-body">
        <div class="row">
            <div class="alert alert-info alert-dismissible fade in" role="alert">
                <strong>Note:</strong> Due to the availability of our records, we are only able to show earnings made after March 31, 2021. However, all-time royalties are accurately reflected in the royalties tab.
                <button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>
            </div>
        </div>
        <div class="table-responsive">
            <table class="table" id="tblEarnings">
                <thead>
                    <tr><th>Date Recorded</th>
                    <th>For Release</th>
                    <th>Description</th>
                    <th style="text-align:right;">Amount</th>
                </thead>
                <tbody>
                <? if ($earningViewItems != null) {
                        foreach($earningViewItems as $earningViewItem) {
                ?>
                    <tr>
                        <td><?=$earningViewItem->date_recorded;?></td>
                        <td><?=$earningViewItem->release_title==''?"(None)":$earningViewItem->release_title;?></td>
                        <td><?=$earningViewItem->description;?></td>
                        <td style="text-align:right"><?=number_format($earningViewItem->amount, 2);?></td>
                    </tr>
                <?
                        }
                    } else {
                ?>
                No recorded earnings yet.
                <?
                    }
                ?>
                </tbody>
            </table>
        </div>
    </div>
</div>

<script type="text/javascript">
$("#tblEarnings").fancyTable({
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
  inputStyle: "border: 1px solid lightgray; padding:10px; border-radius:5px; font-size: 14px;"
});
</script>