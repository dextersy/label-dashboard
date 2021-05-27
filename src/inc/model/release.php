<?php

require_once('./inc/util/MySQLConnection.php');

class Release{

    public $id;
    public $title;
    public $catalog_no;
    public $UPC;
    public $spotify_link;
    public $apple_music_link;
    public $youtube_link;
    public $release_date;
    public $status;

    function __construct(
        $id = null, 
        $title = null, 
        $catalog_no = null, 
        $UPC= null, 
        $spotify_link= null, 
        $apple_music_link= null, 
        $youtube_link= null,
        $release_date = null,
        $status = null
    ) 
    {
        $this->id = $id;
        $this->title = $title;
        $this->catalog_no = $catalog_no;
        $this->UPC = $UPC;
        $this->spotify_link = $spotify_link;
        $this->apple_music_link = $apple_music_link;
        $this->youtube_link = $youtube_link;
        $this->release_date = $release_date;
        $this->status = $status;
      }

    function fromID($id) {
        $result = MySQLConnection::query("SELECT * FROM `release` WHERE `id` = " . $id);
        if ($row = $result->fetch_assoc()) {
            $this->id = $row['id'];
            $this->title = $row['title'];
            $this->catalog_no = $row['catalog_no'];
            $this->UPC = $row['UPC'];
            $this->spotify_link = $row['spotify_link'];
            $this->apple_music_link = $row['apple_music_link'];
            $this->youtube_link = $row['youtube_link'];
            $this->release_date = $row['release_date'];
            $this->status = $row['status'];
            return true;
        }
        else {
            return false;
        }
    }
}
?>