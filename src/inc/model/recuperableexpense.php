<?php

require_once('./inc/util/MySQLConnection.php');

class RecuperableExpense{

    public $id;
    public $release_id;
    public $expense_description;
    public $expense_amount;
    
    function __construct(
        $id = null, 
        $release_id = null, 
        $expense_description = null, 
        $expense_amount= null
    ) 
    {
        $this->id = $id;
        $this->release_id = $release_id;
        $this->expense_description = $expense_description;
        $this->expense_amount = $expense_amount;
      }

    function fromID($id) {
        $result = MySQLConnection::query("SELECT * FROM `royalty` WHERE `id` = " . $id);
        if ($row = $result->fetch_assoc()) {
            $this->id = $row['id'];
            $this->release_id = $row['release_id'];
            $this->expense_description = $row['expense_description'];
            $this->expense_amount = $row['expense_amount'];
        }
    }

    function fromFormPOST($post) {
        $this->id = $post['id'];
        $this->release_id = $post['release_id'];
        $this->expense_description = $post['expense_description'];
        $this->expense_amount = $post['expense_amount'];
    }

    function save() {

        if ( $this->id == null ) {
            $sql = "INSERT INTO `recuperable_expense` (`release_id`, `expense_description`, `expense_amount`, `date_recorded`) ".
                "VALUES(" .
                "'" . MySQLConnection::escapeString($this->release_id) . "', ".
                "'" . MySQLConnection::escapeString($this->expense_description) . "', ".
                "'" . MySQLConnection::escapeString($this->expense_amount) . "' ,".
                "CURDATE()" .
                ")";
        }
        else {
            $sql = "UPDATE `recuperable_expense` SET ".
                "`release_id` = '" . MySQLConnection::escapeString($this->release_id) . "', " .
                "`expense_description` = '" . MySQLConnection::escapeString($this->expense_description) . "', " .
                "`expense_amount` = '" . MySQLConnection::escapeString($this->expense_amount) . "' " .
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