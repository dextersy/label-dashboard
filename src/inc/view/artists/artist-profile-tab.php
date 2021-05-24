<?php
require_once('./inc/model/artist.php');
$artist = new Artist;
$artist->fromID($_SESSION['current_artist']);
?>
<h3>Your Artist Profile</h3>
<form action="update-artist.php?from=<?=$_SERVER['REQUEST_URI'];?>" method="POST">
    <input type="hidden" name="id" value="<?=$artist->id;?>">
    <div class="form-group">
        <label for="exampleInputEmail1">Name</label>
        <input type="text" class="form-control" id="name" name="name" placeholder="Artist Name" value="<?=$artist->name;?>">
    </div>
    <div class="form-group">
        <label for="exampleInputPassword1">Website URL</label><i class="fab fa-facebook-f"></i>
        <input type="text" class="form-control" id="websiteURL" name="websiteURL" placeholder="Website URL" value="<?=$artist->website_page_url;?>">
    </div>
    <div class="form-group">
        <label for="exampleInputPassword1">Facebook</label>
        <input type="text" class="form-control" id="facebookHandle" name="facebookHandle" placeholder="Facebook handle" value="<?=$artist->facebook_handle;?>">
    </div> 
    <div class="form-group">
        <label for="exampleInputPassword1">Instagram</label>
        <input type="text" class="form-control" id="instagramHandle" name="instagramHandle" placeholder="Instagram handle" value="<?=$artist->instagram_handle;?>">
    </div>     
    <div class="form-group">
        <label for="exampleInputPassword1">Bio</label>
        <textarea class="form-control" id="bio" name="bio"><?=$artist->bio;?></textarea>
    </div>                                                         
    <button type="submit" class="btn btn-default">Save Changes</button>
</form>