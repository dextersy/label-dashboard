<?php
require_once('./inc/model/artist.php');
$artist = new Artist;

if ($_SESSION['current_artist'] != NULL) {
    $artist->fromID($_SESSION['current_artist']);
    $title = "Your Artist Profile";
}
else {
    $title = "New Artist";
}

$formAction = "action.update-artist.php?from=" . $_SERVER['REQUEST_URI'];

?>
<h3><?=$title;?></h3>
<form action="<?=$formAction;?>" method="POST" enctype="multipart/form-data">
    <input type="hidden" name="id" value="<?=$artist->id;?>">
    <div class="row">
        <div class="col-md-4">
            <img src="<?=($artist->profile_photo!="") ? $artist->profile_photo : "assets/img/placeholder.jpg";?>" width="100%" style="border:#cccccc 1px solid; padding:5px;">
            <div class="form-group">
                <label for="profile_photo">Profile Photo</label>
                <input type="file" class="form-control" id="profile_photo" name="profile_photo" accept=".jpg, .png" />
            </div>
        </div>
        <div class="col-md-4">
            <div class="form-group">
                <label for="name">Name</label>
                <input type="text" class="form-control" id="name" name="name" placeholder="Artist Name" value="<?=$artist->name;?>">
            </div>
            <div class="form-group">
                <label for="websiteURL">Website URL</label><i class="fab fa-facebook-f"></i>
                <input type="text" class="form-control" id="websiteURL" name="websiteURL" placeholder="Website URL" value="<?=$artist->website_page_url;?>">
            </div>
            <div class="form-group">
                <label for="facebookHandle">Facebook</label><i class="fa fa-facebook" aria-hidden="true"></i>
                <input type="text" class="form-control" id="facebookHandle" name="facebookHandle" placeholder="Facebook handle" value="<?=$artist->facebook_handle;?>">
            </div> 
            <div class="form-group">
                <label for="instagramHandle">Instagram <i class="fa fa-instagram" aria-hidden="true"></i></label>
                <input type="text" class="form-control" id="instagramHandle" name="instagramHandle" placeholder="Instagram handle" value="<?=$artist->instagram_handle;?>">
            </div>
            <div class="form-group">
                <label for="twitterHandle">Twitter <i class="fa fa-twitter" aria-hidden="true"></i></label>
                <input type="text" class="form-control" id="twitterHandle" name="twitterHandle" placeholder="Twitter handle" value="<?=$artist->twitter_handle;?>">
            </div>     
            <div class="form-group">
                <label for="bio">Bio</label>
                <textarea class="form-control" id="bio" name="bio"><?=$artist->bio;?></textarea>
            </div>                                                            
            <button type="submit" class="btn btn-default">Save Changes</button>
        </div>
    </div>
</form>