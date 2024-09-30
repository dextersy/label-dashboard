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

class UserReleaseViewItem {
    public $catalog_no;
    public $cover_art;
    public $artist_name;
    public $title;
    public $release_date;
    public $total_earnings;
}
function getReleaseListForAdmin($brand_id, $limit) {
    return getReleaseListForUser(null, $limit, $brand_id);
}
function getReleaseListForUser($user_id, $limit = null, $brand_id = null){
    $sql = "SELECT DISTINCT r.catalog_no, r.cover_art, r.title, a.name, r.release_date
            FROM `release` r
            JOIN `release_artist` ra ON r.id = ra.release_id
            JOIN `artist` a ON ra.artist_id = a.id
            JOIN `artist_access` aa ON a.id = aa.artist_id
            JOIN `user` u ON aa.user_id = u.id ";

    if($user_id != null) {
        $sql = $sql . "WHERE u.id = '". $user_id . "'";
    }
    else {
        $sql = $sql . "WHERE u.brand_id = '" . $brand_id ."'";
    }
    $sql = $sql . " ORDER BY r.release_date DESC";
    if(isset($limit)) {
        $sql = $sql . " LIMIT 0, " . $limit;
    }

    $result = MySQLConnection::query($sql);
    $i = 0;
    while($row = $result->fetch_assoc()) {
        $releases[$i] = new UserReleaseViewItem;
        $releases[$i]->catalog_no = $row['catalog_no'];
        $releases[$i]->cover_art = $row['cover_art'];
        $releases[$i]->artist_name = $row['name'];
        $releases[$i]->title = $row['title'];
        $releases[$i]->release_date = $row['release_date'];
        $i++;
    }
    return $releases;
}

function getReleaseEarningsListForAdmin($brand_id, $limit) {
    return getReleaseEarningsListForUser(null, $limit, $brand_id);
}
function getReleaseEarningsListForUser($user_id, $limit = null, $brand_id = null){
    $sql = "SELECT r.catalog_no, r.title, a.name, SUM(DISTINCT e.amount) as total_earnings
            FROM `release` r
            JOIN `release_artist` ra ON r.id = ra.release_id
            JOIN `artist` a ON ra.artist_id = a.id
            JOIN `artist_access` aa ON a.id = aa.artist_id
            LEFT JOIN `earning` e ON e.release_id = r.id
            JOIN `user` u ON aa.user_id = u.id ";

    if($user_id != null) {
        $sql = $sql . "WHERE u.id = '". $user_id . "'";
    }
    else {
        $sql = $sql . "WHERE u.brand_id = '" . $brand_id ."'";
    }
    $sql = $sql . " GROUP BY r.id, a.name ";
    $sql = $sql . " ORDER BY total_earnings DESC";
    if(isset($limit)) {
        $sql = $sql . " LIMIT 0, " . $limit;
    }

    $result = MySQLConnection::query($sql);
    $i = 0;
    while($row = $result->fetch_assoc()) {
        $releases[$i] = new UserReleaseViewItem;
        $releases[$i]->catalog_no = $row['catalog_no'];
        $releases[$i]->artist_name = $row['name'];
        $releases[$i]->title = $row['title'];
        $releases[$i]->total_earnings = $row['total_earnings'];
        $i++;
    }
    return $releases;
}



function getAllReleases($brand_id) {
    $sql = "SELECT `id` FROM `release` " . 
        "WHERE brand_id = '" . $brand_id . "' " .
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