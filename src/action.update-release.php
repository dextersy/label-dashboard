<?php
    require_once('./inc/model/release.php');
    require_once('./inc/model/releaseartist.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/util/FileUploader.php');
    require_once('./inc/controller/access_check.php');

    // Check if total splits don't exceed 100
    $totalSyncRoyalties = 0;
    $totalDownloadRoyalties = 0;
    $totalStreamingRoyalties = 0;
    $totalPhysicalRoyalties = 0;
    for ($i = 1; $_POST['artist_id_'.$i] != ""; $i++) {
        $totalSyncRoyalties += $_POST['sync_royalty_'.$i];
        $totalDownloadRoyalties += $_POST['download_royalty_'.$i];
        $totalStreamingRoyalties += $_POST['streaming_royalty_'.$i];
        $totalPhysicalRoyalties += $_POST['physical_royalty_'.$i];
    }
    if($totalSyncRoyalties > 100 || $totalDownloadRoyalties > 100 || $totalStreamingRoyalties > 100 || $totalPhysicalRoyalties > 100) {
        redirectTo("/artist.php?action=release&stat=royalty_err");
        die();
    }

    
    $release = new Release;
    $release->fromFormPOST($_POST);
    if(isset($_FILES["cover_art"]["tmp_name"]) && $_FILES["cover_art"]["tmp_name"] != "") {
        $release->cover_art = uploadImage($_FILES['cover_art']['name'], $_FILES['cover_art']['tmp_name']);
    }
    
    $release_id = $release->save();

    for ($i = 1; $_POST['artist_id_'.$i] != ""; $i++) {
        $artistRelease = new ReleaseArtist($_POST['artist_id_'.$i], $release_id);
        $artistRelease->streaming_royalty_percentage = $_POST['streaming_royalty_'.$i] / 100;
        $artistRelease->sync_royalty_percentage = $_POST['sync_royalty_'.$i] / 100;
        $artistRelease->download_royalty_percentage = $_POST['download_royalty_'.$i] / 100;
        $artistRelease->physical_royalty_percentage = $_POST['physical_royalty_'.$i] / 100;
        $artistRelease->saveNew();
    }

    redirectTo("/artist.php?action=release&result=" . $result);
?>