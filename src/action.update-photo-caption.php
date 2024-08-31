<?php
    require_once('./inc/model/artistimage.php');
    require_once('./inc/controller/access_check.php');
    
    $artistImage = new ArtistImage;
    $artistImage->fromFormPOST($_POST);
    $artistImage->save();

    redirectTo("/artist.php?action=updatePhotoCaption&status=OK#gallery");
?>