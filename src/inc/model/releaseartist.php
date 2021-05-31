<?php

require_once('./inc/util/MySQLConnection.php');

class ReleaseArtist{

    public $artist_id;
    public $release_id;

    function __construct(
        $artist_id = null, 
        $release_id = null
    ) 
    {
        $this->artist_id = $artist_id;
        $this->release_id = $release_id;
    }


    function fromID($artist_id, $release_id) {
        $result = MySQLConnection::query("SELECT * FROM `release_artist` WHERE `artist_id` = " . $artist_id . " AND `release_id` = " . $release_id);
        if ($result->num_rows > 0 && $row = $result->fetch_assoc()) {
            $this->release_id = $row['release_id'];
            $this->artist_id = $row['artist_id'];
            return true;
        }
        return false;
    }

    function saveNew() {
        $sql = "INSERT INTO `release_artist` (`artist_id`, `release_id`) ".
                    "VALUES(" .
                    "'" . $this->artist_id . "', ".
                    "'" . $this->release_id . "'".
                    ")";
        $result = MySQLConnection::query($sql);
        if ($result) {
            return true;
        }
        else {
            return false;
        }
    }

}

?>