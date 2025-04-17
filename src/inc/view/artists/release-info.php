<?
    include_once('./inc/controller/get-artist-list.php');
    include_once('./inc/controller/get-release-list.php');
    include_once('./inc/model/release.php');

    $artists = getAllArtists($_SESSION['brand_id']);
    $defaultCatNo = generateCatalogNumber($_SESSION['brand_id']);
?>

<?
    if(isset($_GET['edit_release']) && isset($_GET['id'])) { 
        $is_editing = true;
        $release = new Release;
        $release->fromID($_GET['id']);
?>
<a href="artist.php#releases"><button class="btn">Back to releases</button></a>
<?
    }
?>
<div class="card">
    <div class="card-header">
        <h4 class="title"><?=$is_editing? "Edit Release" : "New Release";?></h4>
    </div>
    <div class="card-body">
        <form action="action.update-release.php" method="POST" enctype="multipart/form-data">
            <div class="row">
                <div class="col-md-6">
                <input type="hidden" name="brand_id" value="<?=$_SESSION['brand_id'];?>">
<?
    if($is_editing) {
?>
                <input type="hidden" name="id" value="<?=$release->id;?>">
<?
    }
?>
                <input type="hidden" name="artist_id_1" value="<?=$_SESSION['current_artist'];?>">
                    <div class="form-group">
                        <label for="cover_art">Cover art</label><br>
<?
    if($is_editing) {
?>
                        <img src="<?=($release->cover_art!="") ? $release->cover_art : "assets/img/placeholder.jpg";?>" width="40%" style="border:#cccccc 1px solid; padding:5px;">
<?
    }
?>
                        <input type="file" class="form-control" id="cover_art" name="cover_art" accept=".jpg, .png">
                    </div>
                    <div class="form-group">
                    <label for="description">Title</label>
                        <input type="text" class="form-control" id="title" name="title" placeholder="Title" value="<?=$release->title;?>" required>
                    </div>
                    <div class="form-group">
                        <label for="catalog_no">Catalog Number (Default is autogenerated)</label>
                        <input type="text" class="form-control" id="catalog_no" name="catalog_no" placeholder="Catalog Number" value="<?=$release->catalog_no;?>" value="<?=$defaultCatNo;?>" required>
                    </div>
                    <div class="form-group">
                        <label for="bio">Liner notes</label><br>
                        <small>Please add your liner notes, acknowledgments, or credits. This will appear on the release page on the Melt Records website and on Bandcamp. It will NOT appear on Spotify, Apple Music, or other streaming platforms.<br>
                        Suggestion: Mention the cover art designer, producer, mixing and mastering, any additional musicians (not part of featured artists), and the studio where you recorded it. If you have specific thanks, you can also indicate it here.</small>
                        <textarea class="form-control" id="txt_liner_notes" name="liner_notes" style="height:250px;"><?=$release->liner_notes;?></textarea>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="form-group">
                        <label for="UPC">UPC</label>
                        <input type="text" class="form-control" id="UPC" name="UPC" value="<?=$release->UPC;?>" placeholder="UPC/EAN code">
                    </div>  
                    <div class="form-group">
                        <label for="amount">Release Date</label>
                        <input type="date" class="form-control" id="release_date" name="release_date" placeholder="Release Date" value="<?=$release->release_date;?>" required>
                    </div>
                    <div class="form-group">
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" value="1" name="live" id="live">
                            <label class="form-check-label" for="flexCheckDefault">Already released</label>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="bio">Tell us something about this release.</label><br>
                        <small>Give us a quick statement about the release, indicating what the song is about, the musical approach, production stories, and any future plans related to the song. We will use this to craft our pitch to playlists as well as for our press releases. We will not use this exactly as you provide, so feel free to give us a bullet list or just a rough statement.</small>
                        <textarea class="form-control" id="txt_description" name="description" style="height:250px;"><?=$release->description;?></textarea>
                    </div> 
                </div>
            </div>
        <? if ($isAdmin) { ?>
            <h5 class="text-center">Royalty Splits</h5>
            <div class="table-responsive">
            <table class="table">
            <tr><th></th><th>Sync royalty</th><th>Download royalty</th><th>Streaming royalty</th><th>Physical royalty</th></tr>
                    <tr>
                        <td width="60%"><?=$_SESSION['current_artist_name'];?></td>
                        <td width="10%">
                        <div class="input-group">
                            <input type="number" class="form-control" name="sync_royalty_1" id="sync_royalty_1" min="0" max="100" step="1" value="50">
                            <div class="input-group-addon">%</div>
                        </div>
                        </td>
                        <td width="10%">
                        <div class="input-group">
                            <input type="number" class="form-control" name="download_royalty_1" id="download_royalty_1" min="0" max="100" step="1" value="50">
                            <div class="input-group-addon">%</div>
                        </div>
                        </td>
                        <td width="10%">
                            <div class="input-group">
                            <input type="number" class="form-control" name="streaming_royalty_1" id="streaming_royalty_1" min="0" max="100" step="1" value="50">
                            <div class="input-group-addon">%</div>
                            </div>
                        </td>
                    <td width="10%">
                            <div class="input-group">
                            <input type="number" class="form-control" name="physical_royalty_1" id="physical_royalty_1" min="0" max="100" step="1" value="50">
                            <div class="input-group-addon">%</div>
                        </div>
                        </td>
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
                        <td width="10%">
                        <div class="input-group">
                            <input type="number" class="form-control" name="sync_royalty_<?=$i;?>" id="sync_royalty_<?=$i;?>" min="0" max="100" step="1" value="50">
                            <div class="input-group-addon">%</div>
                        </div>
                        </td>
                        <td width="10%">
                        <div class="input-group">
                            <input type="number" class="form-control" name="download_royalty_<?=$i;?>" id="download_royalty_<?=$i;?>" min="0" max="100" step="1" value="50">
                            <div class="input-group-addon">%</div>
                        </div>
                        </td>
                        <td width="10%">
                            <div class="input-group">
                            <input type="number" class="form-control" name="streaming_royalty_<?=$i;?>" id="streaming_royalty_<?=$i;?>" min="0" max="100" step="1" value="50">
                            <div class="input-group-addon">%</div>
                            </div>
                        </td>
                    <td width="10%">
                            <div class="input-group">
                            <input type="number" class="form-control" name="physical_royalty_<?=$i;?>" id="physical_royalty_<?=$i;?>" min="0" max="100" step="1" value="50">
                            <div class="input-group-addon">%</div>
                        </div>
                        </td>
                    </tr>
        <?  } ?>
                </table>
            </div>
    </div>
<?
    }
?>
    <div class="row save-panel">
        <div class="col-xs-6">
            <button type="submit" class="btn btn-primary btn-block">Save Changes</button>
        </div>
        <div class="col-xs-6">
            <a href="artist.php#releases"><button type="button" class="btn btn-secondary btn-block">Cancel</button></a>
        </div>
    </div>
</form>
</div>