<?php

require_once('./inc/util/MySQLConnection.php');

class Payment {

    public $id;
    public $description;
    public $amount;
    public $artist_id;
    public $date_paid;
    
    function __construct(
        $id = null, 
        $description = null, 
        $amount = null, 
        $artist_id= null, 
        $date_paid= null
    ) 
    {
        $this->id = $id;
        $this->description = $description;
        $this->amount = $amount;
        $this->artist_id = $artist_id;
        $this->date_paid = $date_paid;
      }

    function fromID($id) {
        $result = MySQLConnection::query("SELECT * FROM `payment` WHERE `id` = " . $id);
        if ($row = $result->fetch_assoc()) {
            $this->id = $row['id'];
            $this->description = $row['description'];
            $this->amount = $row['amount'];
            $this->artist_id = $row['artist_id'];
            $this->date_paid = $row['date_paid'];
        }
    }

    function fromFormPOST($post) {
        $this->id = $post['id'];
        $this->description = $post['description'];
        $this->amount = $post['amount'];
        $this->artist_id = $post['artist_id'];
        $this->date_paid = $post['date_paid'];
    }

    function save() {

        if ( $this->id == null ) {
            $sql = "INSERT INTO `payment` (`description`, `amount`, `artist_id`, `date_paid`) ".
                "VALUES(" .
                "'" . $this->description . "', ".
                "'" . $this->amount . "', ".
                "'" . $this->artist_id . "', ".
                "CURDATE()".
                ")";
        }
        else {
            $sql = "UPDATE `payment` SET ".
                "`description` = '" . $this->description . "', " .
                "`amount` = '" . $this->amount . "', " .
                "`artist_id` = '" . $this->artist_id . "', " .
                "`date_paid` = '" . $this->date_paid . "' " .
                "WHERE `id` = " . $this->id;
        }
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