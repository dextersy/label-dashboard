<?php

require_once('./inc/util/MySQLConnection.php');

class Artist{

    public $id;
    public $name;
    public $website_page_url;
    public $facebook_handle;
    public $instagram_handle;
    public $twitter_handle;
    public $bio;
    public $starting_balance;

    function __construct(
        $id = null, 
        $name = null, 
        $website_page_url = null, 
        $facebook_handle= null, 
        $instagram_handle= null, 
        $twitter_handle= null, 
        $bio= null, 
        $starting_balance= null) 
    {
        $this->id = $id;
        $this->name = $name;
        $this->website_page_url = $website_page_url;
        $this->facebook_handle = $facebook_handle;
        $this->instagram_handle = $instagram_handle;
        $this->twitter_handle = $twitter_handle;
        $this->bio = $bio;
        $this->starting_balance = $starting_balance;
      }

    function fromID($id) {
        $result = MySQLConnection::query("SELECT * FROM `artist` WHERE `id` = " . $id);
        if ($row = $result->fetch_assoc()) {
            $this->id = $id;
            $this->name = $row['name'];
            $this->website_page_url = $row['website_page_url'];
            $this->facebook_handle = $row['facebook_handle'];
            $this->instagram_handle = $row['instagram_handle'];
            $this->twitter_handle = $row['twitter_handle'];
            $this->bio = $row['bio'];
            $this->starting_balance = $row['starting_balance'];
        }
    }

    function fromFormPOST($post) {
        $this->id = $_POST['id'];
        $this->name = $_POST['name'];
        $this->website_page_url = $_POST['websiteURL'];
        $this->facebook_handle = $_POST['facebookHandle'];
        $this->instagram_handle = $_POST['instagramHandle'];
        $this->twitter_handle = $_POST['twitterHandle'];
        $this->bio = $_POST['bio'];
    }

    function save() {
        $sql = "UPDATE `artist` SET ".
            "`name` = '" . $this->name . "', " .
            "`website_page_url` = '" . $this->website_page_url . "', " .
            "`facebook_handle` = '" . $this->facebook_handle . "', " .
            "`instagram_handle` = '" . $this->instagram_handle . "', " .
            "`twitter_handle` = '" . $this->twitter_handle . "', " .
            "`bio` = '" . $this->bio . "' " .
            "WHERE `id` = " . $this->id;
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