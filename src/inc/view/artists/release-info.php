<?
    include_once('./inc/controller/get-artist-list.php');

    $artists = getAllArtists();
?>

<h3>New Release</h3>
<form action="action.update-release.php" method="POST" enctype="multipart/form-data">
    <div class="row">
        <div class="col-md-4">
        <input type="hidden" name="artist_id_1" value="<?=$_SESSION['current_artist'];?>">
            <div class="form-group">
                <label for="cover_art">Cover art</label>
                <input type="file" class="form-control" id="cover_art" name="cover_art" accept=".jpg, .png">
            </div>
            <div class="form-group">
            <label for="description">Title</label>
                <input type="text" class="form-control" id="title" name="title" placeholder="Title">
            </div>
            <div class="form-group">
                <label for="catalog_no">Catalog Number</label>
                <input type="text" class="form-control" id="catalog_no" name="catalog_no" placeholder="Catalog Number">
            </div>
            <div class="form-group">
                <label for="UPC">UPC</label>
                <input type="text" class="form-control" id="UPC" name="UPC" placeholder="Catalog Number">
            </div>  
            <div class="form-group">
                <label for="amount">Release Date</label>
                <input type="date" class="form-control" id="release_date" name="release_date" placeholder="Release Date">
            </div> 
            <div class="form-group">
                <input class="form-check-input" type="checkbox" value="1" name="live" id="live">
                <label class="form-check-label" for="flexCheckDefault">Already released</label>
            </div>
        </div>
    </div>
    <h4>Royalty Splits</h4>
    <div class="table-responsive">
    <table class="table">
    <tr><th></th><th>Sync royalty</th><th>Download royalty</th><th>Streaming royalty</th><th>Physical royalty</th></tr>
            <tr>
                <td width="60%">Main artist royalties</td>
                <td width="10%"><input type="number" class="form-control" name="sync_royalty_1" id="sync_royalty_1" min="0" max="100" step="1" value="50">% of revenue</td>
                <td width="10%"><input type="number" class="form-control" name="download_royalty_1" id="download_royalty_1" min="0" max="100" step="1" value="50">% of revenue</td>
                <td width="10%"><input type="number" class="form-control" name="streaming_royalty_1" id="streaming_royalty_1" min="0" max="100" step="1" value="50">% of revenue</td>
               <td width="10%"><input type="number" class="form-control" name="physical_royalty_1" id="physical_royalty_1" min="0" max="100" step="1" value="20">% of revenue</td>
            </tr>
    </table>        
        <table class="table">
            <tr><th>Additional artists:</th><th>Sync royalty</th><th>Download royalty</th><th>Streaming royalty</th><th>Physical royalty</th></tr>
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
               <td width="10%"><input type="number" class="form-control" name="physical_royalty_<?=$i;?>" id="physical_royalty_<?=$i;?>" min="0" max="100" step="1" value="20">% of revenue</td>
            </tr>
<?  } ?>
        </table>
    </div>
    <button type="submit" class="btn btn-default">Save Changes</button>
</form>