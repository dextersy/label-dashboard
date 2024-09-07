<?
    require_once('./inc/model/artist.php');
    require_once('./inc/controller/get-release-list.php');

    if ($_SESSION['current_artist']) {
        $releases = getReleaseListForArtist($_SESSION['current_artist']);
    }
    function getReleaseStatusString($status) {
        if ( $status == 'Pending' ) {
            $class = "badge-secondary";
        } else if ($status == 'Live' ) {
            $class = "badge-success";
        } else if ($status == 'Taken Down') {
            $class = "badge-light";
        }

        return "<span class=\"badge " . $class . "\">" . $status . "</span>";
    }
?>
<? if ($isAdmin) { ?>
<script type="text/javascript">
    function activateEditRelease(id, title, cat_no, upc, release_date, status) {
        document.getElementById('edit_release_form').style.display = "block";
        document.getElementById('release_id').value = id;
        document.getElementById('title').value = title;
        document.getElementById('catalog_no').value = cat_no;
        document.getElementById('UPC').value = upc;
        document.getElementById('release_date').value = release_date;
        if(status=="Live") {
            document.getElementById('live').checked = true;
        }
        else {
            document.getElementById('live').checked = false;
        }
    }
    function hideEditRelease() {
        document.getElementById('edit_release_form').style.display = "none";
    }
</script>
<? } ?>
<h3>Releases</h3>
<form action="action.update-release.php" method="POST" enctype="multipart/form-data">
<input type="hidden" name="id" id="release_id" value="" />
<div class="card" id="edit_release_form" style="display:none;">
    <div class="card-header"><h5>Edit this release</h5></div>
    <div class="card-body"><div class="row">
        <div class="col-md-3">
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
            
        </div>
        <div class="col-md-3">
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
    </div></div>
    <div class="card-footer">
        <button type="submit" class="btn btn-default">Save Changes</button>
        <button type="button" class="btn btn-default" onclick="hideEditRelease();">Cancel</button>
    </div>
</div>
</form>


<div class="table-responsive">
    <table class="table">
        <thead>
            <tr><th></th>
            <th>Catalog Number</th>
            <th>Title</th>
            <th>Date released</th>
            <!--<th>Links </th>-->
            <th>Status</th>
            <th></th>
        </thead>
        <tbody>
<? if ($releases) {
        foreach ($releases as $release) { ?>
            <tr>
                <td><img style="width:100px;height:100px;object-fit:cover;" src="<?=$release->cover_art!=""?$release->cover_art:"assets/img/placeholder.jpg";?>"></td>
                <td><?=$release->catalog_no;?></td>
                <td><?=$release->title;?></td>
                <td><?=$release->release_date;?></td>
                <!--
                <td>
                    <a href="<?=$release->spotify_link!=""?$release->spotify_link:"#";?>" target="_blank"><i style="font-size: 1.5em;" class="fa fa-spotify"></i></a>
                    <a href="<?=$release->apple_link!=""?$release->apple_link:"#";;?>" target="_blank"><i style="font-size: 1.5em;"  class="fa fa-apple"></i></a>
                    <a href="<?=$release->youtube_link!=""?$release->youtube_link:"#";?>" target="_blank"><i style="font-size: 1.5em;"  class="fa fa-youtube"></i></a>
                    <a href="<?=$release->bandcamp_link!=""?$release->bandcamp_link:"#";?>" target="_blank"><i style="font-size: 1.5em;"  class="fa fa-bandcamp"></i></a>
                </td>
                -->
                <td><?=getReleaseStatusString($release->status);?></a></td>
                <td>
                <? if ($isAdmin) { ?>
                    <a href="#" 
                    onclick="activateEditRelease('<?=$release->id;?>', 
                        '<?=addslashes($release->title);?>', '<?=$release->catalog_no;?>', '<?=$release->UPC;?>', 
                        '<?=$release->release_date;?>', '<?=$release->status;?>')">
                    <i class="fa fa-pencil"></i>
                </a>
                <? } ?>
                </td>
            </tr>
<?      } 
    } else { ?>
    No releases yet.
<?  } ?>
        </tbody>
    </table>
</div>