<?
    include_once('./inc/controller/media-controller.php');

    $photoGallery = getPhotoGalleryForArtist($_SESSION['current_artist']);

?>
<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js" type="text/javascript"></script>
<script type="text/javascript">
    function toggleEditCaption(i) {
        var span = document.getElementById('span_caption_' + i);
        var form = document.getElementById('form_editCaption_' + i);
        if(span.style.display == 'none') {
            span.style.display = 'block';
            form.style.display = 'none';
        }
        else {
            span.style.display = 'none';
            form.style.display = 'block';
        }
    }
</script>

<h3>Photo Gallery</h3>

<div class="row">
<?
    $i = 0;
    if ($photoGallery) {
        foreach($photoGallery as $photo) {
?>
<div class="col-md-2">
    <div class="artist-gallery-container">
        <img src="<?=$photo->path;?>" class="artist-gallery-image img-thumbnail"><br>
        <span id="span_caption_<?=$i;?>">
            <?=($photo->credits != '' && isset($photo->credits)) ? $photo->credits : "<em>Add a caption</em>";?> 
            <a href="javascript:toggleEditCaption('<?=$i;?>');"><i class="fa fa-pencil"></i></a>
        </span>
        <div id="form_editCaption_<?=$i;?>" style="display:none;">
            <form action="action.update-photo-caption.php" method="POST">
                <input type="hidden" name="id" value="<?=$photo->id;?>">
                <div class="input-group">
                    <input type="text" class="form-control" name="credits" value="<?=$photo->credits;?>">
                    <div class="input-group-btn">
                        <button type="submit" class="btn"><i class="fa fa-save"></i></button>
                        <button type="button" class="btn btn-link" onclick="javascript:toggleEditCaption('<?=$i;?>');"><i class="fa fa-close"></i></button>
                    </div>
                </div>
            </form>
        </div>
        <div class="artist-gallery-delete-button-container">
        <a class="artist-gallery-delete-button" data-toggle="modal" data-id="<?=$photo->id;?>" title="Delete this photo" href="#confirm-delete">X</a>
        </a>
        </div>
    </div> 
</div>
<?      
        $i++;
        }
    } else {
?>
    No photos added yet.
<?
    } 
?>
</div>

<div class="modal fade" id="confirm-delete" tabindex="-1" role="dialog" aria-labelledby="deleteConfirmationLabel" aria-hidden="true" data-backdrop="false">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                Confirm deletion
            </div>
            <div class="modal-body">
                Are you sure you want to delete this image?<br>
                <input type="hidden" name="photoId" id="photoId" value=""/>
            </div>
            <div class="modal-footer">
                <a href="#" id="submit" class="btn btn-primary">Yes</a>
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
            </div>
        </div>
    </div>
</div>
<script type="text/javascript">
    $(document).on("click", ".artist-gallery-delete-button", function () {
       var photoId = $(this).data('id');
       $(".modal-body #photoId").val( photoId );
    });
    $('#submit').click(function(){
        var photoId = $(".modal-body #photoId").val();
        window.location.href = "/action.delete-media.php?id=" + photoId;
    });
</script>
<p>&nbsp;</p>
<form action="action.upload-photo.php" method="POST" enctype="multipart/form-data">
<input type="hidden" name="artist_id" id="artist_id" value="<?=$_SESSION['current_artist'];?>" />
<input type="hidden" name="date_uploaded" value="<?=Date("Y-m-d");?>">
<div class="row">
    <div class="col-md-4">
        <div class="card">
            <div class="card-header"><h5>Upload Photos</h5></div>
            <div class="card-body">
                <em>You can add captions / credits later.</em>
                <div class="input-group">
                    <input type="file" class="form-control" id="gallery_image" name="gallery_image[]" accept=".jpg, .png" multiple>
                    <div class="input-group-btn">
                        <button type="submit" class="btn btn-default">Upload</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
</form>

