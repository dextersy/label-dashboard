<?
    require_once('./inc/model/release.php');
    require_once('./inc/controller/get-release-list.php');

    $releases = getAllReleases();
?>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/2.1.3/jquery.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-select/1.6.3/js/bootstrap-select.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.2/js/bootstrap.js"></script>
<link href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-select/1.6.3/css/bootstrap-select.css" rel="stylesheet"/>
<link href="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.2/css/bootstrap.css" rel="stylesheet"/>
<script type="text/javascript">
    function onSelectApplyAllType(){
        var i = 0;
        var selectedIndex = document.getElementById("applyAllType").selectedIndex;
        while(document.getElementById('type_' + i)){
            document.getElementById('type_' + i).selectedIndex = selectedIndex;
            i++;
        }
    }

    function onInputApplyAllDescription() {
        var i = 0;
        var description = document.getElementById('applyAllDescription').value;
        document.getElementById('applyAllDescription').value = "";
        while(document.getElementById('description_'+i)) {
            document.getElementById('description_' + i).value = description;
            i++;
        }
    }

    function onCheckApplyAllCalculateRoyalties() {
        var i = 0;
        var checked = document.getElementById('applyAllCalculateRoyalties').checked;
        while(document.getElementById('calculateRoyalties_'+i)) {
            document.getElementById('calculateRoyalties_' + i).checked = checked;
            i++;
        }
    }

    function onInputAmount() {
        var totalAmount = 0;
        for(var i = 0; document.getElementById('amount_'+i); i++) {
            totalAmount += Number(document.getElementById('amount_'+i).value);
        }
        document.getElementById('total_earnings_display').innerHTML = "P" + totalAmount.toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
    }
</script>
<h3>Bulk Add Earnings</h3>
<div class="row">
    <div class="col-md-3">
        <strong>Current total earnings:</strong> <span id="total_earnings_display"></span>
    </div>
</div>
<form action="action.bulk-add-earnings.php" method="POST">
<div class="table-responsive">
    <table class="table">
        <thead>
            <tr><th>Release</th>
            <th>Earning Type</th>
            <th>Earning Description</th>
            <th>Earning Amount</th>
            <th>Calculate royalties</th>
        </thead>
        <tbody>
        <tr style="background-color:#f1f1f1;">
            <td><em>Apply to all</em></td>
            <td><select class="form-control" name="applyAllType" id="applyAllType" onchange="onSelectApplyAllType();">
                    <option value="Sync">Sync</option>
                    <option value="Streaming">Streaming</option>
                    <option value="Downloads">Downloads</option>
                    <option value="Physical">Physical</option>
                </select></td>
            <td><input type="text" class="form-control" id="applyAllDescription" name="applyAllDescription" placeholder="Description" onchange="onInputApplyAllDescription();"></td>
            <td></td>
            <td><input class="form-check-input" type="checkbox" value="1" name="applyAllCalculateRoyalties" id="applyAllCalculateRoyalties" onclick="onCheckApplyAllCalculateRoyalties();" checked></td>

        </tr>
<? 
        for ($i = 0; $i < 20; $i++) { // TODO No. of rows should be dynamic 
?>
            <tr>
                <td><select class="selectpicker" data-live-search="true" name="release_id_<?=$i;?>" id="release_id_<?=$i;?>">
                <option value="-1"></option>
<?
            foreach($releases as $release) {
?>
                <option value="<?=$release->id;?>"><?=$release->catalog_no;?>: <?=$release->title;?></option>

<?  } ?>
                </select></td>
                <td><select class="form-control" id="type_<?=$i;?>" name="type_<?=$i;?>">
                    <option value="Sync">Sync</option>
                    <option value="Streaming">Streaming</option>
                    <option value="Downloads">Downloads</option>
                    <option value="Physical">Physical</option>
                </select>
                </td>
                <td><input type="text" class="form-control" id="description_<?=$i;?>" name="description_<?=$i;?>" placeholder="Description"></td>
                <td><input type="text" class="form-control" id="amount_<?=$i;?>" name="amount_<?=$i;?>" placeholder="Amount" onChange="onInputAmount();"></td>
                <td><input class="form-check-input" type="checkbox" value="1" name="calculateRoyalties_<?=$i;?>" id="calculateRoyalties_<?=$i;?>" checked></td>
            </tr>
<?      } ?>
        </tbody>
    </table>
</div>
<button type="submit" class="btn btn-default">Save All Earnings</button>
</form>