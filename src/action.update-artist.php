<?php
    require_once('./inc/model/artist.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/controller/access_check.php');

    $artist = new Artist;
    $artist->fromFormPOST($_POST);
    $artist->save();

    $_SESSION['current_artist'] = $artist->id;

    redirectTo("/artist.php?action=profile")
?>