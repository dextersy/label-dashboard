<?
    include_once('./inc/controller/media-controller.php');

    $photoGallery = getPhotoGalleryForArtist($_SESSION['current_artist']);

?>
<h3>Photo Gallery</h3>

<div class="row">
<div class="col-md-12">
<?
    if ($photoGallery) {
        foreach($photoGallery as $photo) {
?>
    <div class="artist-gallery-container">
        <img src="<?=$photo->path;?>" class="artist-gallery-image">
        <div class="artist-gallery-delete-button"><a href="action.delete-media.php?id=<?=$photo->id;?>" style="color:#FFFFFF;">X</a></div>
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
