<?
    require_once('./inc/controller/access_check.php');
    require_once('./inc/model/brand.php');
    require_once('./inc/controller/email_log_controller.php');

    if(!$isAdmin) { redirectTo('/index.php'); die(); }

    $emailAttempts = getAllEmailAttempts($_SESSION['brand_id'], 500);
?>
<div class="overlay" id="divEmailPreview" style="display:none">
<div class="card">
    <div class="card-header"><b>Email preview</b> <a href="javascript:closePreview();">[ Close ]</a></div>
    <div class="card-body">
    <iframe id="iframeEmailPreview" src="#" height="600" width="100%"></iframe>
    </div>
</div>
</div>
<h3>Other tools</h3>
<div class="card">
    <div class="card-header"><h5>Email logs</h5></div>
    <div class="card-body">
    <div class="table-responsive">

        <table class="table" id="tblEmailLogs">
            <thead>
            <tr>
                <th>Timestamp</th>
                <th>Recipients</th>
                <th>Subject</th>
                <th>Result</th>
                <th>Actions</th>
            </thead>
            <tbody>
<?
    foreach ($emailAttempts as $emailAttempt) { 
    ?>
        <tr>
            <td><?=date_format(date_create($emailAttempt->timestamp),'Y-m-d H:i:s');?></td>
            <td><?=$emailAttempt->recipients;?></td>
            <td><?=$emailAttempt->subject;?></td>
            <td>
                <? if($emailAttempt->result == 'Success') { ?>
                <div class="badge" style="background-color:green">Success</div>
                <? } else { ?>
                <div class="badge badge-warning">Failed</div>
                <? } ?>
            </td>
            <td><a href="javascript:showEmail('<?=$emailAttempt->id;?>')">[ Show message ]</a>
        </tr>
<?
    }
?>
            </tbody>
        </table>
    </div>
    </div>

</div>


<script src="/assets/js/jquery.3.2.1.min.js"></script>
<script src="/assets/js/fancyTable.min.js"></script>
<script type="text/javascript">
function showEmail(id) {
    var url = "/inc/view/admin/preview-email.php?id=" + id;
    var frame = document.getElementById('iframeEmailPreview');
    var div = document.getElementById('divEmailPreview');
    frame.src = url;
    div.style.display = 'block';
}

function closePreview() {
    var div = document.getElementById('divEmailPreview');
    div.style.display = 'none';
}

$("#tblEmailLogs").fancyTable({
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