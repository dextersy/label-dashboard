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
        $cover_art = null,
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
        $this->cover_art = $cover_art;
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
            $this->cover_art = $row['cover_art'];
            $this->status = $row['status'];
            return true;
        }
        else {
            return false;
        }
    }

    function fromFormPOST($post) {
        $this->id = $post['id'];
        $this->title = $post['title'];
        $this->catalog_no = $post['catalog_no'];
        $this->UPC = $post['UPC'];
        $this->spotify_link = $post['spotify_link'];
        $this->apple_music_link = $post['apple_music_link'];
        $this->youtube_link = $post['youtube_link'];
        $this->release_date = $post['release_date'];
        $this->status = ($post['live'] == '1') ? "Live" : "Pending";
    }

    function save() {

        if ( $this->id == null ) {
            $sql = "INSERT INTO `release` (`title`, `catalog_no`, `UPC`, `spotify_link`, `apple_music_link`, `youtube_link`, `release_date`, `cover_art`, `status`) ".
                "VALUES(" .
                "'" . MySQLConnection::escapeString($this->title) . "', ".
                "'" . MySQLConnection::escapeString($this->catalog_no) . "', ".
                "'" . MySQLConnection::escapeString($this->UPC) . "', ".
                "'" . MySQLConnection::escapeString($this->spotify_link) . "', ".
                "'" . MySQLConnection::escapeString($this->apple_music_link) . "', " .
                "'" . MySQLConnection::escapeString($this->youtube_link) . "', " .
                "'" . MySQLConnection::escapeString($this->release_date) . "', " .
                "'" . MySQLConnection::escapeString($this->cover_art) . "', " .
                "'" . MySQLConnection::escapeString($this->status) . "'" .
                ")";
        }
        else {
            $sql = "UPDATE `release` SET ".
                "`title` = '" . MySQLConnection::escapeString($this->title) . "', " .
                "`catalog_no` = '" . MySQLConnection::escapeString($this->catalog_no) . "', " .
                "`UPC` = '" . MySQLConnection::escapeString($this->UPC) . "', " .
                "`spotify_link` = '" . MySQLConnection::escapeString($this->spotify_link) . "', " .
                "`apple_music_link` = '" . MySQLConnection::escapeString($this->apple_music_link) . "', " .
                "`youtube_link` = '" . MySQLConnection::escapeString($this->youtube_link) . "', " .
                "`release_date` = '" . MySQLConnection::escapeString($this->release_date) . "', " .
                "`cover_art` = '" . MySQLConnection::escapeString($this->cover_art) . "', " .
                "`status` = '" . MySQLConnection::escapeString($this->status) . "' " .
                "WHERE `id` = " . $this->id;
        }
        $result = MySQLConnection::query($sql);
        if ($result) {
            return MySQLConnection::$lastInsertID;
        }
        else {
            return false;
        }
    }
}
?>