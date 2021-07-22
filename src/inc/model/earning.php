<?php

require_once('./inc/util/MySQLConnection.php');

class Earning{

    public $id;
    public $release_id;
    public $type;
    public $amount;
    public $description;
    public $date_recorded;
    
    function __construct(
        $id = null, 
        $release_id = null, 
        $type = null, 
        $amount = null,
        $description = null,
        $date_recorded = null
    ) 
    {
        $this->id = $id;
        $this->release_id = $release_id;
        $this->type = $type;
        $this->amount = $amount;
        $this->description = $description;
        $this->date_recorded = $date_recorded;
      }

    function fromID($id) {
        $result = MySQLConnection::query("SELECT * FROM `earning` WHERE `id` = " . $id);
        if ($row = $result->fetch_assoc()) {
            $this->id = $row['id'];
            $this->release_id = $row['release_id'];
            $this->type = $row['type'];
            $this->amount = $row['amount'];
            $this->description = $row['description'];
            $this->date_recorded = $row['date_recorded'];
        }
    }

    function fromFormPOST($post) {
        $this->id = $post['id'];
        $this->release_id = $post['release_id'];
        $this->type = $post['type'];
        $this->amount = $post['amount'];
        $this->description = $post['description'];
        $this->date_recorded = $post['date_recorded'];
    }

    function save() {

        if ( $this->id == null ) {
            $sql = "INSERT INTO `earning` (`release_id`, `type`, `amount`, `description`, `date_recorded`) ".
                "VALUES(" .
                "'" . MySQLConnection::escapeString($this->release_id) . "', ".
                "'" . MySQLConnection::escapeString($this->type) . "', ".
                "'" . MySQLConnection::escapeString($this->amount) . "', ".
                "'" . MySQLConnection::escapeString($this->description) . "', " .
                "CURDATE()".
                ")";
        }
        else {
            $sql = "UPDATE `royalty` SET ".
                "`release_id` = '" . MySQLConnection::escapeString($this->release_id) . "', " .
                "`type` = '" . MySQLConnection::escapeString($this->type) . "', " .
                "`amount` = '" . MySQLConnection::escapeString($this->amount) . "', " .
                "`description` = '" . MySQLConnection::escapeString($this->description) . "', " .
                "`date_recorded` = '" . MySQLConnection::escapeString($this->date_recorded) . "' " .
                "WHERE `id` = " . $this->id;
        }

        $result = MySQLConnection::query($sql);
        if ($result) {
            if ($this->id == null) {
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