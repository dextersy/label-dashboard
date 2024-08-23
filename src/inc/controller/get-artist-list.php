<?php
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/artist.php');

class ArtistListItem {
    public $id;
    public $name;
    public $payout_point;

    function __construct($id, $name, $payout_point) {
        $this->id = $id;
        $this->name = $name;
        $this->payout_point = $payout_point;
    }
}

function getAllArtists($brand_id){
    $result = MySQLConnection::query("SELECT * FROM `artist` WHERE `brand_id`='" . $brand_id ."' ORDER BY `name` ASC");
    if ($result->num_rows < 1) {
        return null;
    }
    
    $i = 0;
    while($row = $result->fetch_assoc()) {
        $artists[$i++] = new ArtistListItem(
            $row['id'],
            $row['name'],
            $row['payout_point']
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
            $row['payout_point']
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
            $row['payout_point']
        );
    }
    return $artists;
}

?>