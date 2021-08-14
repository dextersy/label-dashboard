<?
    require_once('./inc/model/release.php');
    require_once('./inc/controller/get-release-list.php');

    $releases = getAllReleases();
?>

<h3>Bulk Add Earnings</h3>
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
<? 
        for ($i = 0; $i < 20; $i++) { // TODO No. of rows should be dynamic 
?>
            <tr>
                <td><select class="form-control" name="release_id_<?=$i;?>">
                <option value="-1"></option>
<?
            foreach($releases as $release) {
?>
                <option value="<?=$release->id;?>"><?=$release->catalog_no;?>: <?=$release->title;?></option>

<?  } ?>
                </select></td>
                <td><select class="form-control" name="type_<?=$i;?>">
                    <option value="Sync">Sync</option>
                    <option value="Streaming">Streaming</option>
                    <option value="Downloads">Downloads</option>
                    <option value="Physical">Physical</option>
                </select>
                </td>
                <td><input type="text" class="form-control" id="description_<?=$i;?>" name="description_<?=$i;?>" placeholder="Description"></td>
                <td><input type="text" class="form-control" id="amount_<?=$i;?>" name="amount_<?=$i;?>" placeholder="Amount"></td>
                <td><input class="form-check-input" type="checkbox" value="1" name="calculateRoyalties_<?=$i;?>" id="calculateRoyalties_<?=$i;?>" checked></a></td>
            </tr>
<?      } ?>
        </tbody>
    </table>
</div>
<button type="submit" class="btn btn-default">Save All Earnings</button>
</form>