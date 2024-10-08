<?php
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/artist.php');

class ArtistListItem {
    public $id;
    public $name;
    public $payout_point;
    public $hold_payouts;

    function __construct($id, $name, $payout_point, $hold_payouts) {
        $this->id = $id;
        $this->name = $name;
        $this->payout_point = $payout_point;
        $this->hold_payouts = $hold_payouts;
    }
}

function getAllArtists($brand_id, $limit = null){
    $query = "SELECT * FROM `artist` WHERE `brand_id`='" . $brand_id ."' ORDER BY `name` ASC";
    if (isset($limit)) {
        $query = $query . " LIMIT 0, " . $limit;
    }
    $result = MySQLConnection::query($query);
    
    if ($result->num_rows < 1) {
        return null;
    }
    
    $i = 0;
    while($row = $result->fetch_assoc()) {
        $artists[$i++] = new ArtistListItem(
            $row['id'],
            $row['name'],
            $row['payout_point'],
            $row['hold_payouts']
        );
    }
    return $artists;
}
function getArtistListForUser($user){
    $result = MySQLConnection::query($sql = "SELECT * FROM `artist` " .
        "WHERE `id` IN (" .
            "SELECT `artist_id` FROM `artist_access` WHERE `user_id` = '" . $user . "'".
            ") ".
        "ORDER BY `name` ASC");
    if ($result->num_rows < 1) {
        return null;
    }

    $i = 0;
    while($row = $result->fetch_assoc()) {
        $artists[$i++] = new Artist(
            $row['id'],
            $row['name'],
            $row['payout_point'],
            $row['hold_payouts']
        );
    }
    return $artists;
}
function getArtistListForRelease($release_id) {
    $result = MySQLConnection::query($sql = "SELECT * FROM `artist` " .
        "WHERE `id` IN (" .
            "SELECT `artist_id` FROM `release_artist` WHERE `release_id` = '" . $release_id . "'".
            ") ".
        "ORDER BY `id` ASC");
    if ($result->num_rows < 1) {
        return null;
    }

    $i = 0;
    while($row = $result->fetch_assoc()) {
        $artists[$i++] = new Artist(
            $row['id'],
            $row['name'],
            $row['payout_point'],
            $row['hold_payouts']
        );
    }
    return $artists;
}

?>