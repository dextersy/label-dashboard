<?php

require_once('./inc/util/MySQLConnection.php');

class Event{

    public $id;
    public $title;
    public $date_and_time;
    public $description;
    public $poster_url;
    public $venue;

    function __construct(
        $id = null, 
        $brand_id = null,
        $title = null, 
        $date_and_time = null,
        $description = null,
        $poster_url = null,
        $venue = null
    ) 
    {
        $this->id = $id;
        $this->brand_id = $brand_id;
        $this->title = $title; 
        $this->date_and_time = $date_and_time;
        $this->description = $description;
        $this->poster_url = $poster_url;
        $this->venue = $venue;
      }

    function fromID($id) {
        $result = MySQLConnection::query("SELECT * FROM `event` WHERE `id` = " . $id);
        if ($result->num_rows > 0 && $row = $result->fetch_assoc()) {
            $this->id = $row['id'];
            $this->brand_id = $row['brand_id'];
            $this->title = $row['title']; 
            $this->date_and_time = $row['date_and_time'];
            $this->description = $row['description'];
            $this->poster_url = $row['poster_url'];
            $this->venue = $row['venue'];
            return true;
        }
        else {
            return false;
        }
    }

    function fromFormPOST($post) {
        if (isset($_POST['id'])) {
            $this->id = $_POST['id'];
            $this->fromID($this->id);
        }
        $this->brand_id = $post['brand_id'];
        $this->title = $post['title']; 
        $this->date_and_time = $post['date_and_time'];
        $this->description = $post['description'];
        $this->venue = $post['venue'];
    }

    function save() {

        if ( $this->id == null ) {
            $sql = "INSERT INTO `event` (`brand_id`, `title`, `date_and_time`, `description`, `poster_url`, `venue`) ".
                "VALUES(" .
                "'" . MySQLConnection::escapeString($this->brand_id) . "', ".
                "'" . MySQLConnection::escapeString($this->title) . "', ".
                "'" . MySQLConnection::escapeString($this->date_and_time) . "', ".
                "'" . MySQLConnection::escapeString($this->description) . "', ".
                "'" . MySQLConnection::escapeString($this->poster_url) . "', ".
                "'" . MySQLConnection::escapeString($this->venue) . "'" .
                ")";
        }
        else {
            $sql = "UPDATE `event` SET ".
                "`brand_id` = '" . MySQLConnection::escapeString($this->brand_id) . "', " .
                "`title` = '" . MySQLConnection::escapeString($this->title) . "', " .
                "`date_and_time` = '" . MySQLConnection::escapeString($this->date_and_time) . "', " .
                "`description` = '" . MySQLConnection::escapeString($this->description) . "', " .
                "`poster_url` = '" . MySQLConnection::escapeString($this->poster_url) . "', " .
                "`venue` = '" . MySQLConnection::escapeString($this->venue) . "' " .
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