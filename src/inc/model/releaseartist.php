<?php

require_once('./inc/util/MySQLConnection.php');

class ReleaseArtist{

    public $artist_id;
    public $release_id;
    public $streaming_royalty_percentage;
    public $streaming_royalty_type;
    public $sync_royalty_percentage;
    public $sync_royalty_type;
    public $download_royalty_percentage;
    public $download_royalty_type;
    public $physical_royalty_percentage;
    public $physical_royalty_type;

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
            $this->streaming_royalty_percentage = $row['streaming_royalty_percentage'];
            $this->streaming_royalty_type = $row['streaming_royalty_type'];
            $this->sync_royalty_percentage = $row['sync_royalty_percentage'];
            $this->sync_royalty_type = $row['sync_royalty_type'];
            $this->download_royalty_percentage = $row['download_royalty_percentage'];
            $this->download_royalty_type = $row['download_royalty_type'];
            $this->physical_royalty_percentage = $row['physical_royalty_percentage'];
            $this->physical_royalty_type = $row['physical_royalty_type'];
            return true;
        }
        return false;
    }

    function saveNew() {
        $sql = "INSERT INTO `release_artist` (`artist_id`, `release_id`) ".
                    "VALUES(" .
                    "'" . MySQLConnection::escapeString($this->artist_id) . "', ".
                    "'" . MySQLConnection::escapeString($this->release_id) . "'".
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