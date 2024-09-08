<?php
    require_once('./inc/model/release.php');
    require_once('./inc/model/releaseartist.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/util/FileUploader.php');
    require_once('./inc/controller/access_check.php');

    
    for ($i = 1; isset($_POST['release_id_'.$i]) && $_POST['release_id_' . $i] != ""; $i++) {
        $releaseArtist = new ReleaseArtist();
        $releaseArtist->fromID($_POST['artist_id_'.$i], $_POST['release_id_'.$i]);

        $releaseArtist->sync_royalty_percentage = $_POST['sync_royalty_' . $i] / 100;
        $releaseArtist->streaming_royalty_percentage = $_POST['streaming_royalty_' . $i] / 100;
        $releaseArtist->download_royalty_percentage = $_POST['download_royalty_' . $i] / 100;
        $releaseArtist->physical_royalty_percentage = $_POST['physical_royalty_' . $i] / 100;

        $result = $releaseArtist->save();
    }
    redirectTo("/financial.php?action=updateRoyalties&status=" . ($result ? "OK":"Failed") . "#release");
?>