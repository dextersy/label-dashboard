<?
    include_once('./inc/controller/media-controller.php');

    $photoGallery = getPhotoGalleryForArtist($_SESSION['current_artist']);

?>
<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js" type="text/javascript"></script>

<h3>Photo Gallery</h3>

<div class="row">
<div class="col-md-12">
<?
    if ($photoGallery) {
        foreach($photoGallery as $photo) {
?>
    <div class="artist-gallery-container">
        <img src="<?=$photo->path;?>" class="artist-gallery-image">
        <div class="artist-gallery-delete-button-container">
        <a class="artist-gallery-delete-button" data-toggle="modal" data-id="<?=$photo->id;?>" title="Delete this photo" href="#confirm-delete">X</a>
        </a>
        </div>
    </div> 
<?      }
    } else {
?>
    No photos added yet.
<?
    } 
?>
</div>
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

<form action="action.upload-photo.php" method="POST" enctype="multipart/form-data">
<input type="hidden" name="artist_id" id="artist_id" value="<?=$_SESSION['current_artist'];?>" />
<input type="hidden" name="date_uploaded" value="<?=Date("Y-m-d");?>">
<div class="row">
    <div class="card">
        <div class="col-md-3">
            <div class="form-group">
            <label for="cover_art">Upload new</label>
                <input type="file" class="form-control" id="gallery_image" name="gallery_image" accept=".jpg, .png">
            </div>
            <div class="form-group">
            <label for="description">Credits</label>
                <input type="text" class="form-control" id="credits" name="credits" placeholder="Title">
            </div>
            <button type="submit" class="btn btn-default">Upload</button>
        </div>
    </div>
</div>
</form>

