<?php
    require_once('./inc/controller/access_check.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/controller/media-controller.php');

    if (deleteMedia($_GET['id'])) {
        redirectTo("/artist.php?action=deletePhoto&status=OK");
    }
    else {
        redirectTo("/artist.php?action=deletePhoto&status=failed");
    }
?>