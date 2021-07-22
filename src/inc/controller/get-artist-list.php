<?php
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/artist.php');

function getAllArtists(){
    $result = MySQLConnection::query("SELECT * FROM `artist` ORDER BY `name` ASC");
    if ($result->num_rows < 1) {
        return null;
    }
    
    $i = 0;
    while($row = $result->fetch_assoc()) {
        $artists[$i++] = new Artist(
            $row['id'],
            $row['name'],
            $row['website_page_url'],
            $row['facebook_handle'],
            $row['instagram_handle'],
            $row['twitter_handle'],
            $row['bio'],
            $row['starting_balance']
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
            $row['website_page_url'],
            $row['facebook_handle'],
            $row['instagram_handle'],
            $row['twitter_handle'],
            $row['bio'],
            $row['starting_balance']
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
            $row['website_page_url'],
            $row['facebook_handle'],
            $row['instagram_handle'],
            $row['twitter_handle'],
            $row['bio'],
            $row['starting_balance']
        );
    }
    return $artists;
}

?>