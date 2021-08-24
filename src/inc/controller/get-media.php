<?php
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/artistimage.php');


function getPhotoGalleryForArtist($artist_id, $start = 0, $limit = -1){
    $sql = "SELECT `id` FROM `artist_image` " .
            "WHERE `artist_id` = ". $artist_id . " ".
            "ORDER BY `date_uploaded` DESC";
    if ($limit >= 0) {
        $sql = $sql . " LIMIT ". $start .", " . $limit;
    }
    $result = MySQLConnection::query($sql);
    $i = 0;
    
    while($result->num_rows > 0 && $row = $result->fetch_assoc()) {
        $artistImages[$i] = new ArtistImage;
        $artistImages[$i]->fromID($row['id']);
        $i++;
    }
    return $artistImages;
}
?>