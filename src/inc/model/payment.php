<?php

require_once('./inc/util/MySQLConnection.php');

class Payment {

    public $id;
    public $description;
    public $amount;
    public $artist_id;
    public $date_paid;
    public $paid_thru_type;
    public $paid_thru_account_name;
    public $paid_thru_account_number;
    
    function __construct(
        $id = null, 
        $description = null, 
        $amount = null, 
        $artist_id= null, 
        $date_paid= null,
        $paid_thru_type= null,
        $paid_thru_account_name= null,
        $paid_thru_account_number= null
    ) 
    {
        $this->id = $id;
        $this->description = $description;
        $this->amount = $amount;
        $this->artist_id = $artist_id;
        $this->date_paid = $date_paid;
        $this->paid_thru_type = $paid_thru_type;
        $this->paid_thru_account_name = $paid_thru_account_name;
        $this->paid_thru_account_number = $paid_thru_account_number;
      }

    function fromID($id) {
        $result = MySQLConnection::query("SELECT * FROM `payment` WHERE `id` = " . $id);
        if ($row = $result->fetch_assoc()) {
            $this->id = $row['id'];
            $this->description = $row['description'];
            $this->amount = $row['amount'];
            $this->artist_id = $row['artist_id'];
            $this->date_paid = $row['date_paid'];
            $this->paid_thru_type = $row['paid_thru_type'];
            $this->paid_thru_account_name = $row['paid_thru_account_name'];
            $this->paid_thru_account_number = $row['paid_thru_account_number'];
        }
    }

    function fromFormPOST($post) {
        if (isset($_POST['id'])) {
            $this->id = $_POST['id'];
            $this->fromID($this->id);
        }
        $this->description = $post['description'];
        $this->amount = $post['amount'];
        $this->artist_id = $post['artist_id'];
        $this->date_paid = $post['date_paid'];
        $this->paid_thru_type = $post['paid_thru_type'];
        $this->paid_thru_account_name = $post['paid_thru_account_name'];
        $this->paid_thru_account_number = $post['paid_thru_account_number'];
    }

    function save() {

        if ( $this->id == null ) {
            $sql = "INSERT INTO `payment` (`description`, `amount`, `artist_id`, `date_paid`, `paid_thru_type`, `paid_thru_account_name`, `paid_thru_account_number`) ".
                "VALUES(" .
                "'" . MySQLConnection::escapeString($this->description) . "', ".
                "'" . MySQLConnection::escapeString($this->amount) . "', ".
                "'" . MySQLConnection::escapeString($this->artist_id) . "', ".
                "'" . MySQLConnection::escapeString($this->date_paid) . "', ".
                "'" . MySQLConnection::escapeString($this->paid_thru_type) . "', ".
                "'" . MySQLConnection::escapeString($this->paid_thru_account_name) . "', ".
                "'" . MySQLConnection::escapeString($this->paid_thru_account_number) . "'".
                ")";
        }
        else {
            $sql = "UPDATE `payment` SET ".
                "`description` = '" . MySQLConnection::escapeString($this->description) . "', " .
                "`amount` = '" . MySQLConnection::escapeString($this->amount) . "', " .
                "`artist_id` = '" . MySQLConnection::escapeString($this->artist_id) . "', " .
                "`date_paid` = '" . MySQLConnection::escapeString($this->date_paid) . "', " .
                "`paid_thru_type` = '" . MySQLConnection::escapeString($this->paid_thru_type) . "', " .
                "`paid_thru_account_name` = '" . MySQLConnection::escapeString($this->paid_thru_account_name) . "', " .
                "`paid_thru_account_number` = '" . MySQLConnection::escapeString($this->paid_thru_account_number) . "' " .
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