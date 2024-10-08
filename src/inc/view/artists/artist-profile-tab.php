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
<form action="<?=$formAction;?>" method="POST" enctype="multipart/form-data">
    <input type="hidden" name="id" value="<?=$artist->id;?>">
    <input type="hidden" name="brand_id" value="<?=$_SESSION['brand_id'];?>">
    <input type="hidden" name="payoutPoint" value="<?=$artist->payout_point;?>">
    <div class="row">
        
        <div class="col-md-4">
            <div class="card">
                <div class="card-header"><h4 class="title">Basic Information</h4></div>
                <div class="card-body">
                    <div class="form-group">
                        <label for="name">Name</label>
                        <input type="text" class="form-control" id="name" name="name" placeholder="Artist Name" value="<?=$artist->name;?>">
                    </div>
                    <div class="form-group">
                        <label for="bandMembers">Band Members</label>
                        <textarea class="form-control" id="bandMembers" name="bandMembers" rows="4" placeholder="Band Members"><?=$artist->band_members;?></textarea>
                    </div>
                    <div class="form-group">
                        <label for="bio">Bio</label>
                        <textarea class="form-control" id="bio" name="bio" style="height:250px;"><?=$artist->bio;?></textarea>
                    </div>
                </div>
            </div>
        </div>

        <div class="col-md-4">
            <div class="card">
                <div class="card-header">
                    <h4 class="title">Links</h4>
                </div>
                <div class="card-body">
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
                        <label for="tiktokHandle">Tiktok</label><i class="fa fab-tiktok"></i>
                        <input type="text" class="form-control" id="tiktokHandle" name="tiktokHandle" placeholder="Tiktok handle" value="<?=$artist->tiktok_handle;?>">
                    </div>
                    <div class="form-group">
                        <label for="youtubeChannel">YouTube Channel</label><i class="fa fa-youtube"></i>
                        <input type="text" class="form-control" id="youtubeChannel" name="youtubeChannel" placeholder="YouTube channel" value="<?=$artist->youtube_channel;?>">
                    </div>  
                </div>
            </div>
        </div>

        <div class="col-md-4">
            <div class="card">
                <div class="card-header">
                    <h4 class="title">Profile Photo</h4>
                </div>
                <div class="card-body">
                    <div class="form-group">
                        <img src="<?=($artist->profile_photo!="") ? $artist->profile_photo : "assets/img/placeholder.jpg";?>" width="100%" style="border:#cccccc 1px solid; padding:5px;">
                        <input type="file" class="form-control" id="profile_photo" name="profile_photo" accept=".jpg, .png" />
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="row save-panel">
        <button type="submit" class="btn btn-primary btn-block"><i class="fa fa-save"></i>Save Changes</button>
    </div>
</form>