<?php
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/artistdocument.php');


function getDocumentsForArtist($artist_id, $start = 0, $limit = -1){
    $sql = "SELECT `id` FROM `artist_documents` " .
            "WHERE `artist_id` = ". $artist_id . " ".
            "ORDER BY `date_uploaded` DESC";
    if ($limit >= 0) {
        $sql = $sql . " LIMIT ". $start .", " . $limit;
    }
    $result = MySQLConnection::query($sql);
    $i = 0;
    
    while($result->num_rows > 0 && $row = $result->fetch_assoc()) {
        $artistDocuments[$i] = new ArtistDocument;
        $artistDocuments[$i]->fromID($row['id']);
        $i++;
    }
    return $artistDocuments;
}
?>