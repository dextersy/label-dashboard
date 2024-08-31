<?php
    require_once('./inc/model/artistimage.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/util/FileUploader.php');

    $number_of_images = count($_FILES['gallery_image']['tmp_name']);
    for ($i = 0; $i < $number_of_images; $i++) {
        
        if(isset($_FILES["gallery_image"]["tmp_name"][$i]) && $_FILES["gallery_image"]["tmp_name"][$i] != "") {
            $artistImage = new ArtistImage;
            $artistImage->artist_id = $_POST['artist_id'];
            $artistImage->date_uploaded = $_POST['date_uploaded'];
            $artistImage->credits = ""; // Leave blank for later
            $artistImage->path = uploadImage($_FILES["gallery_image"]["name"][$i], $_FILES["gallery_image"]["tmp_name"][$i]);
            $artistImage->save();
        }
    }
    redirectTo("/artist.php?action=uploadPhoto&status=OK#gallery");
?>