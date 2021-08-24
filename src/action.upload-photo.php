<?php
    require_once('./inc/model/artistimage.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/util/FileUploader.php');

    $artistImage = new ArtistImage;
    $artistImage->fromFormPOST($_POST);
    if(isset($_FILES["gallery_image"]["tmp_name"]) && $_FILES["gallery_image"]["tmp_name"] != "") {
        $artistImage->path = uploadImage($_FILES['gallery_image']);
    }
    $artistImage->save();

    redirectTo("/artist.php#gallery");
?>