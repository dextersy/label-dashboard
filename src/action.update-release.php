<?php
    require_once('./inc/model/release.php');
    require_once('./inc/model/releaseartist.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/controller/access_check.php');

    $release = new Release;
    $release->fromFormPOST($_POST);
    $release_id = $release->save();


    for ($i = 1; $_POST['artist_id_'.$i] != ""; $i++) {
        $artistRelease = new ReleaseArtist($_POST['artist_id_'.$i], $release_id);
        $artistRelease->saveNew();
    }

    redirectTo("/artist.php?action=release")
?>