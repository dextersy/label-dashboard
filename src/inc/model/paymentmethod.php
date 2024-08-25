<?php

require_once('./inc/util/MySQLConnection.php');

class PaymentMethod{

    public $id;
    public $artist_id;
    public $type;
    public $account_name;
    public $account_number_or_email;
    public $is_default_for_artist;

    function __construct(
        $id = null, 
        $artist_id = null, 
        $type = null, 
        $account_name= null, 
        $account_number_or_email= null,
        $is_default_for_artist= null
    ) 
    {
        $this->id = $id;
        $this->artist_id = $artist_id;
        $this->type = $type;
        $this->account_name = $account_name;
        $this->account_number_or_email = $account_number_or_email;
        $this->is_default_for_artist = $is_default_for_artist;
      }

    function fromID($id) {
        $result = MySQLConnection::query("SELECT * FROM `payment_method` WHERE `id` = " . $id);
        if ($row = $result->fetch_assoc()) {
            $this->id = $row['id'];
            $this->artist_id = $row['artist_id'];
            $this->type = $row['type'];
            $this->account_name = $row['account_name'];
            $this->account_number_or_email = $row['account_number_or_email'];
            $this->is_default_for_artist = $row['is_default_for_artist'];
            return true;
        }
        else {
            return false;
        }
    }

    function fromFormPOST($post) {
        if (isset($post['id'])) {
            $this->id = $post['id'];
            $this->fromID($this->id);
        }
        $this->artist_id = $post['artist_id'];
        $this->type = $post['type'];
        $this->account_name = $post['account_name'];
        $this->account_number_or_email = $post['account_number_or_email'];
        $this->is_default_for_artist = isset($post['is_default_for_artist']) ? $post['is_default_for_artist'] : "0";
    }

    function save() {

        if ( $this->id == null ) {
            $sql = "INSERT INTO `payment_method` (`artist_id`, `type`, `account_name`, `account_number_or_email`, `is_default_for_artist`) ".
                "VALUES(" .
                "'" . MySQLConnection::escapeString($this->artist_id) . "', ".
                "'" . MySQLConnection::escapeString($this->type) . "', ".
                "'" . MySQLConnection::escapeString($this->account_name) . "', ".
                "'" . MySQLConnection::escapeString($this->account_number_or_email) . "', ".
                "'" . MySQLConnection::escapeString($this->is_default_for_artist) . "'" .
                ")";
        }
        else {
            $sql = "UPDATE `payment_method` SET ".
                "`title` = '" . MySQLConnection::escapeString($this->artist_id) . "', " .
                "`catalog_no` = '" . MySQLConnection::escapeString($this->type) . "', " .
                "`UPC` = '" . MySQLConnection::escapeString($this->account_name) . "', " .
                "`spotify_link` = '" . MySQLConnection::escapeString($this->account_number_or_email) . "', " .
                "`status` = '" . MySQLConnection::escapeString($this->is_default_for_artist) . "' " .
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