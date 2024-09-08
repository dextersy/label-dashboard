<?php

require_once('./inc/util/MySQLConnection.php');

class Payment {

    public $id;
    public $description;
    public $amount;
    public $artist_id;
    public $date_paid;
    public $payment_method_id;
    public $reference_number;
    
    function __construct(
        $id = null, 
        $description = null, 
        $amount = null, 
        $artist_id= null, 
        $date_paid= null,
        $payment_method_id= null,
        $reference_number= null
    ) 
    {
        $this->id = $id;
        $this->description = $description;
        $this->amount = $amount;
        $this->artist_id = $artist_id;
        $this->date_paid = $date_paid;
        $this->payment_method_id = $payment_method_id;
        $this->reference_number = $reference_number;
      }

    function fromID($id) {
        $result = MySQLConnection::query("SELECT * FROM `payment` WHERE `id` = " . $id);
        if ($row = $result->fetch_assoc()) {
            $this->id = $row['id'];
            $this->description = $row['description'];
            $this->amount = $row['amount'];
            $this->artist_id = $row['artist_id'];
            $this->date_paid = $row['date_paid'];
            $this->payment_method_id = $row['payment_method_id'];
            $this->reference_number = $row['reference_number'];
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
        $this->payment_method_id = (isset($post['payment_method_id'])&&$post['payment_method_id']!='') ? $post['payment_method_id']:null;
        $this->reference_number = $post['reference_number'];
    }

    function save() {
        $payment_method_id = (isset($this->payment_method_id) && $this->payment_method_id != null) ? ("'".MySQLConnection::escapeString($this->payment_method_id)."'") : "NULL";

        if ( $this->id == null ) {
            $sql = "INSERT INTO `payment` (`description`, `amount`, `artist_id`, `date_paid`, `payment_method_id`, `reference_number`) ".
                "VALUES(" .
                "'" . MySQLConnection::escapeString($this->description) . "', ".
                "'" . MySQLConnection::escapeString($this->amount) . "', ".
                "'" . MySQLConnection::escapeString($this->artist_id) . "', ".
                "'" . MySQLConnection::escapeString($this->date_paid) . "', " .
                $payment_method_id . ", " .
                "'" . MySQLConnection::escapeString($this->reference_number) . "'".
                ")";
        }
        else {
            $sql = "UPDATE `payment` SET ".
                "`description` = '" . MySQLConnection::escapeString($this->description) . "', " .
                "`amount` = '" . MySQLConnection::escapeString($this->amount) . "', " .
                "`artist_id` = '" . MySQLConnection::escapeString($this->artist_id) . "', " .
                "`date_paid` = '" . MySQLConnection::escapeString($this->date_paid) . "', " .
                "`payment_method_id` = " . $payment_method_id . ", ".
                "`reference_number` = '" . MySQLConnection::escapeString($this->reference_number) . "' " .
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