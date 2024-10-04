<?
    require_once('./inc/controller/access_check.php');
    require_once('./inc/model/brand.php');
    require_once('./inc/controller/email_log_controller.php');

    if(!$isAdmin) { redirectTo('/index.php'); die(); }

    $emailAttempts = getAllEmailAttempts($_SESSION['brand_id'], 10);
?>
<h3>Other tools</h3>
<div class="card">
    <div class="card-header"><h5>Email logs</h5></div>
    <div class="card-body">
    <div class="table-responsive">

        <table class="table">
            <thead>
            <tr><th>Recipients</th>
                <th>Subject</th>
                <th>Timestamp</th>
                <th>Result</th>
                <th>Actions</th>
            </thead>
            <tbody>
<?
    foreach ($emailAttempts as $emailAttempt) { 
    ?>
        <tr>
            <td><?=$emailAttempt->recipients;?></td>
            <td><?=$emailAttempt->subject;?></td>
            <td><?=date_format(date_create($emailAttempt->timestamp),'M d, Y \a\t h:i:sA');?></td>
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
    <div class="card" id="divEmailPreview" style="display:none">
        <div class="card-header"><b>Email preview</b> <a href="javascript:closePreview();">[ Close ]</a></div>
        <div class="card-body">
        <iframe id="iframeEmailPreview" src="#" height="800" width="100%"></iframe>
        </div>
    </div>
</div>

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
</script>