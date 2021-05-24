<?php
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/release.php');

function getReleaseListForArtist($artist_id){
    $sql = "SELECT `id` FROM `release` WHERE `id` IN " .
            "(SELECT `release_id` FROM `release_artist` WHERE `artist_id` = ". $artist_id . ")";
    $result = MySQLConnection::query($sql);
    $i = 0;
    while($row = $result->fetch_assoc()) {
        $releases[$i] = new Release;
        $releases[$i]->fromID($row['id']);
        $i++;
    }
    return $releases;
}

?>