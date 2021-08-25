<?php
    require_once('./inc/model/artistdocument.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/util/FileUploader.php');

    $artistDocument = new ArtistDocument;
    $artistDocument->fromFormPOST($_POST);
    if(isset($_FILES["document"]["tmp_name"]) && $_FILES["document"]["tmp_name"] != "") {
        $artistDocument->path = uploadDocument($_FILES['document']);
    }
    $artistDocument->save();

    redirectTo("/financial.php#documents");
?>