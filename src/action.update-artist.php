<?php
    require_once('./inc/model/artist.php');
    require_once('./inc/util/Redirect.php');

    $artist = new Artist;
    $artist->fromFormPOST($_POST);
    $artist->save();
    redirectBack();
?>