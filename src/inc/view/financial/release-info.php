<?
    include_once('./inc/controller/get-artist-list.php');
    include_once('./inc/controller/get-release-list.php');
    include_once('./inc/model/release.php');

    $artists = getAllArtists($_SESSION['brand_id']);
    $defaultCatNo = generateCatalogNumber($_SESSION['brand_id']);
    if (isset($_GET['id'])) {
        $release->fromID($_GET['id']);
    }
?>

<h3>Update Royalties</h3>
<form action="action.update-royalties.php" method="POST" enctype="multipart/form-data">
    <h4>Royalty Splits for: <?=</h4>
    <div class="table-responsive">
    <table class="table">
    <tr><th></th><th>Sync royalty</th><th>Download royalty</th><th>Streaming royalty</th><th>Physical royalty</th></tr>
            <tr>
                <td width="60%"><?=$_SESSION['current_artist_name'];?></td>
                <td width="10%"><input type="number" class="form-control" name="sync_royalty_1" id="sync_royalty_1" min="0" max="100" step="1" value="50">% of revenue</td>
                <td width="10%"><input type="number" class="form-control" name="download_royalty_1" id="download_royalty_1" min="0" max="100" step="1" value="50">% of revenue</td>
                <td width="10%"><input type="number" class="form-control" name="streaming_royalty_1" id="streaming_royalty_1" min="0" max="100" step="1" value="50">% of revenue</td>
               <td width="10%"><input type="number" class="form-control" name="physical_royalty_1" id="physical_royalty_1" min="0" max="100" step="1" value="15">% of revenue</td>
            </tr>
<?php
    for ($i = 2; $i <= 6; $i++) { // Magic numbers are just artist numbers from 2 to 6 (meaning 5 rows)... Probably need to make this look better.
?>
            <tr>
                <td width="60%">
                <select class="form-control" name="artist_id_<?=$i;?>">
                <option></option>
<?
        foreach($artists as $artist ) {
            if($artist->id != $_SESSION['current_artist']) {
?>
                 <option value="<?=$artist->id;?>"><?=$artist->name;?></option>

<? 
            } 
        } 
?>
                </select></td>
                <td width="10%"><input type="number" class="form-control" name="sync_royalty_<?=$i;?>" id="sync_royalty_<?=$i;?>" min="0" max="100" step="1" value="50">% of revenue</td>
                <td width="10%"><input type="number" class="form-control" name="download_royalty_<?=$i;?>" id="download_royalty_<?=$i;?>" min="0" max="100" step="1" value="50">% of revenue</td>
                <td width="10%"><input type="number" class="form-control" name="streaming_royalty_<?=$i;?>" id="streaming_royalty_<?=$i;?>" min="0" max="100" step="1" value="50">% of revenue</td>
               <td width="10%"><input type="number" class="form-control" name="physical_royalty_<?=$i;?>" id="physical_royalty_<?=$i;?>" min="0" max="100" step="1" value="15">% of revenue</td>
            </tr>
<?  } ?>
        </table>
    </div>
    <button type="submit" class="btn btn-default">Save Changes</button>
</form>