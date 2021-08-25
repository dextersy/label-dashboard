<?php

require_once('./inc/util/MySQLConnection.php');

class ArtistDocument{

    public $id;
    public $path;
    public $title;
    public $artist_id;
    public $date_uploaded;

    function __construct(
        $id = null, 
        $path = null, 
        $title = null, 
        $artist_id= null,
        $date_uploaded = null) 
    {
        $this->id = $id;
        $this->path = $path;
        $this->title = $title;
        $this->artist_id = $artist_id;
        $this->date_uploaded = $date_uploaded;
    }

    function fromID($id) {
        $result = MySQLConnection::query("SELECT * FROM `artist_documents` WHERE `id` = " . $id);
        if ($result->num_rows > 0 && $row = $result->fetch_assoc()) {
            $this->id = $id;
            $this->path = $row['path'];
            $this->title = $row['title'];
            $this->artist_id = $row['artist_id'];
            $this->date_uploaded = $row['date_uploaded'];
        }
    }

    function fromFormPOST($post) {
        if (isset($_POST['id'])) {
            $this->id = $_POST['id'];
            $this->fromID($this->id);
        }
        $this->title = $_POST['title'];
        $this->artist_id = $_POST['artist_id'];
        $this->date_uploaded = $_POST['date_uploaded'];
    }

    function save() {

        if ( $this->id == null ) {
            $sql = "INSERT INTO `artist_documents` (`path`, `title`, `artist_id`, `date_uploaded`) ".
                "VALUES(" .
                "'" . MySQLConnection::escapeString($this->path) . "', ".
                "'" . MySQLConnection::escapeString($this->title) . "', ".
                "'" . MySQLConnection::escapeString($this->artist_id) . "', ".
                "'" . MySQLConnection::escapeString($this->date_uploaded) . "'".
                ")";
        }
        else {
            $sql = "UPDATE `artist_documents` SET ".
                "`path` = '" . MySQLConnection::escapeString($this->path) . "', " .
                "`title` = '" . MySQLConnection::escapeString($this->title) . "', " .
                "`artist_id` = '" . MySQLConnection::escapeString($this->artist_id) . "', " .
                "`date_uploaded` = '" . MySQLConnection::escapeString($this->date_uploaded) . "' " .
                "WHERE `id` = " . $this->id;
        }
        $result = MySQLConnection::query($sql);
        if ($result) {
            if($this->id == null) {
                $this->id = MySQLConnection::$lastInsertID;
            }
            return true;
        }
        else {
            return false;
        }
    }
}
?>