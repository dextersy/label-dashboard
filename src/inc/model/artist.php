<?php

require_once('./inc/util/MySQLConnection.php');

class Artist {
    public $id;
    public $name;
    public $website_page_url;
    public $facebook_handle;
    public $instagram_handle;
    public $twitter_handle;
    public $bio;
    public $profile_photo;
    public $brand_id;
    public $tiktok_handle;
    public $band_members;
    public $youtube_channel;

    function __construct(
        $id = null, 
        $name = null, 
        $website_page_url = null, 
        $facebook_handle = null, 
        $instagram_handle = null, 
        $twitter_handle = null, 
        $bio = null, 
        $profile_photo = null,
        $brand_id = null,
        $tiktok_handle = null,
        $band_members = null,
        $youtube_channel = null
    ) 
    {
        $this->id = $id;
        $this->name = $name;
        $this->website_page_url = $website_page_url;
        $this->facebook_handle = $facebook_handle;
        $this->instagram_handle = $instagram_handle;
        $this->twitter_handle = $twitter_handle;
        $this->bio = $bio;
        $this->profile_photo = $profile_photo;
        $this->brand_id = $brand_id;
        $this->tiktok_handle = $tiktok_handle;
        $this->band_members = $band_members;
        $this->youtube_channel = $youtube_channel;
    }

    function fromID($id) {
        $result = MySQLConnection::query("SELECT * FROM `artist` WHERE `id` = " . $id);
        if ($result->num_rows > 0 && $row = $result->fetch_assoc()) {
            $this->id = $id;
            $this->name = $row['name'];
            $this->website_page_url = $row['website_page_url'];
            $this->facebook_handle = $row['facebook_handle'];
            $this->instagram_handle = $row['instagram_handle'];
            $this->twitter_handle = $row['twitter_handle'];
            $this->bio = $row['bio'];
            $this->profile_photo = $row['profile_photo'];
            $this->brand_id = $row['brand_id'];
            $this->tiktok_handle = $row['tiktok_handle'];
            $this->band_members = $row['band_members'];
            $this->youtube_channel = $row['youtube_channel'];
        }
    }

    function fromFormPOST($post) {
        if (isset($_POST['id'])) {
            $this->id = $_POST['id'];
            $this->fromID($this->id);
        }
        $this->name = $_POST['name'];
        $this->website_page_url = $_POST['websiteURL'];
        $this->facebook_handle = $_POST['facebookHandle'];
        $this->instagram_handle = $_POST['instagramHandle'];
        $this->twitter_handle = $_POST['twitterHandle'];
        $this->bio = $_POST['bio'];
        $this->brand_id = $_POST['brand_id'];
        $this->tiktok_handle = $_POST['tiktokHandle'];
        $this->band_members = $_POST['bandMembers'];
        $this->youtube_channel = $_POST['youtubeChannel'];
    }

    function save() {
        if ($this->id == null) {
            $sql = "INSERT INTO `artist` (`name`, `website_page_url`, `facebook_handle`, `instagram_handle`, `twitter_handle`, `bio`, `profile_photo`, `brand_id`, `tiktok_handle`, `band_members`, `youtube_channel`) " .
                "VALUES(" .
                "'" . MySQLConnection::escapeString($this->name) . "', " .
                "'" . MySQLConnection::escapeString($this->website_page_url) . "', " .
                "'" . MySQLConnection::escapeString($this->facebook_handle) . "', " .
                "'" . MySQLConnection::escapeString($this->instagram_handle) . "', " .
                "'" . MySQLConnection::escapeString($this->twitter_handle) . "', " .
                "'" . MySQLConnection::escapeString($this->bio) . "', " .
                "'" . MySQLConnection::escapeString($this->profile_photo) . "', " .
                "'" . MySQLConnection::escapeString($this->brand_id) . "', " .
                "'" . MySQLConnection::escapeString($this->tiktok_handle) . "', " .
                "'" . MySQLConnection::escapeString($this->band_members) . "', " .
                "'" . MySQLConnection::escapeString($this->youtube_channel) . "'" .
                ")";
        } else {
            $sql = "UPDATE `artist` SET " .
                "`name` = '" . MySQLConnection::escapeString($this->name) . "', " .
                "`website_page_url` = '" . MySQLConnection::escapeString($this->website_page_url) . "', " .
                "`facebook_handle` = '" . MySQLConnection::escapeString($this->facebook_handle) . "', " .
                "`instagram_handle` = '" . MySQLConnection::escapeString($this->instagram_handle) . "', " .
                "`twitter_handle` = '" . MySQLConnection::escapeString($this->twitter_handle) . "', " .
                "`bio` = '" . MySQLConnection::escapeString($this->bio) . "', " .
                "`profile_photo` = '" . MySQLConnection::escapeString($this->profile_photo) . "', " .
                "`brand_id` = '" . MySQLConnection::escapeString($this->brand_id) . "', " .
                "`tiktok_handle` = '" . MySQLConnection::escapeString($this->tiktok_handle) . "', " .
                "`band_members` = '" . MySQLConnection::escapeString($this->band_members) . "', " .
                "`youtube_channel` = '" . MySQLConnection::escapeString($this->youtube_channel) . "' " .
                "WHERE `id` = " . $this->id;
        }

        $result = MySQLConnection::query($sql);
        if ($result) {
            if ($this->id == null) {
                $this->id = MySQLConnection::$lastInsertID;
            }
            return true;
        } else {
            return false;
        }
    }
}
?>