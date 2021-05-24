<?php
    require_once('./inc/model/artist.php');

    $artist = new Artist;
    $artist->fromFormPOST($_POST);
    $artist->save();
    header('Location: http://' .$_SERVER['HTTP_HOST'] . $_GET['from']);
?>