<?php
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/artist.php');

function getArtistListForUser($user){
    $result = MySQLConnection::query("SELECT * FROM `artist`");
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