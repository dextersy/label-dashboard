<?php
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/release.php');

function getReleaseListForArtist($artist_id){
    $sql = "SELECT `id` FROM `release` WHERE `id` IN " .
            "(SELECT `release_id` FROM `release_artist` WHERE `artist_id` = ". $artist_id . ")".
            "ORDER BY `release_date` DESC";
    $result = MySQLConnection::query($sql);
    $i = 0;
    while($row = $result->fetch_assoc()) {
        $releases[$i] = new Release;
        $releases[$i]->fromID($row['id']);
        $i++;
    }
    return $releases;
}

function getAllReleases() {
    $sql = "SELECT `id` FROM `release` ".
            "ORDER BY `catalog_no` ASC";
    $result = MySQLConnection::query($sql);
    $i = 0;
    while($row = $result->fetch_assoc()) {
        $releases[$i] = new Release;
        $releases[$i]->fromID($row['id']);
        $i++;
    }
    return $releases;    
}

function generateCatalogNumber() {
    // TODO Probably need to have a better query here to exclude consignments
    $sql = "SELECT `catalog_no` FROM `release` WHERE `catalog_no` NOT LIKE 'MLTC%' AND `catalog_no` NOT LIKE 'MLV%' ORDER BY `catalog_no` DESC";
    $result = MySQLConnection::query($sql);
    while ($row = $result->fetch_assoc()) {
        $newNumber = (int)str_replace("MLT","",$row['catalog_no']);
        $newNumber++;
        return "MLT" . $newNumber;
    }
    return null;
}

?>