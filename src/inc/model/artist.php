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
    public $payout_point;
    public $hold_payouts;

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
        $youtube_channel = null,
        $payout_point = 1000,
        $hold_payouts = 0
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
        $this->payout_point = $payout_point;
        $this->hold_payouts = $hold_payouts;
    }

    function fromID($id) {
        $sql = "SELECT * FROM `artist` WHERE `id` = " . $id;
        $result = MySQLConnection::query($sql);
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
            $this->payout_point = $row['payout_point'];
            $this->hold_payouts = $row['hold_payouts'];

            return true;
        }
        else {
            return false;
        }
    }

    function fromFormPOST($post) {
        if (isset($post['id']) && strlen($post['id'] > 0)) {
            $this->id = $post['id'];
            $this->fromID($this->id);
        }
        $this->name = $post['name'];
        $this->website_page_url = $post['websiteURL'];
        $this->facebook_handle = $post['facebookHandle'];
        $this->instagram_handle = $post['instagramHandle'];
        $this->twitter_handle = $post['twitterHandle'];
        $this->bio = $post['bio'];
        $this->brand_id = $post['brand_id'];
        $this->tiktok_handle = $post['tiktokHandle'];
        $this->band_members = $post['bandMembers'];
        $this->youtube_channel = $post['youtubeChannel'];
        if (isset($post['payout_point']) && $post['payout_point'] != '') {
            $this->payout_point = $post['payout_point'];
        }
        if (isset($post['hold_payouts']) && $post['hold_payouts'] != '') {
            $this->hold_payouts = $post['hold_payouts'];
        }
    }

    function save() {
        if ($this->id == null) {
            $sql = "INSERT INTO `artist` (`name`, `website_page_url`, `facebook_handle`, `instagram_handle`, `twitter_handle`, `bio`, `profile_photo`, `brand_id`, `tiktok_handle`, `band_members`, `youtube_channel`, `payout_point`, `hold_payouts`) " .
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
                "'" . MySQLConnection::escapeString($this->youtube_channel) . "', " .
                "'" . MySQLConnection::escapeString($this->payout_point) . "', " .
                "'" . MySQLConnection::escapeString($this->hold_payouts) . "'" .
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
                "`youtube_channel` = '" . MySQLConnection::escapeString($this->youtube_channel) . "', " .
                "`payout_point` = '" . MySQLConnection::escapeString($this->payout_point) . "', " .
                "`hold_payouts` = '" . MySQLConnection::escapeString($this->hold_payouts) . "' " .
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