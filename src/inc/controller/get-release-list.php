<?php
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/release.php');
require_once('./inc/model/brand.php');

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

function generateCatalogNumber($brand_id) {
    $brand = new Brand();
    $brand->fromID($brand_id);
    $catalog_prefix = $brand->catalog_prefix;

    $sql = "SELECT `catalog_no` FROM `release` WHERE `brand_id` = '" . $brand_id . "' AND `catalog_no` REGEXP '^". $catalog_prefix . "[0-9]+' ORDER BY `catalog_no` DESC LIMIT 0, 1";
    $result = MySQLConnection::query($sql);
    $newNumber = 0;
    while ($row = $result->fetch_assoc()) {
        $newNumber = (int)str_replace($catalog_prefix,"",$row['catalog_no']);    
    }
    $newNumber++;
    return sprintf("%s%03d", $catalog_prefix, $newNumber);
}

?>