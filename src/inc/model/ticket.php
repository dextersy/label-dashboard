<?php

require_once('./inc/util/MySQLConnection.php');

class Ticket{

    public $id;
    public $event_id;
    public $name;
    public $email_address;
    public $contact_number;
    public $number_of_entries;
    public $ticket_code;
    public $status;
    public $payment_link;
    public $payment_link_id;

    function __construct(
        $id = null, 
        $event_id = null,
        $name = null, 
        $email_address = null,
        $contact_number = null,
        $number_of_entries = null,
        $ticket_code = null,
        $status = null,
        $payment_link = null,
        $payment_link_id = null
    ) 
    {
        $this->id = $id;
        $this->event_id = $event_id;
        $this->name = $name;
        $this->email_address = $email_address;
        $this->contact_number = $contact_number;
        $this->number_of_entries = $number_of_entries;
        $this->ticket_code = $ticket_code;
        $this->status = $status;
        $this->payment_link = $payment_link;
        $this->payment_link_id = $payment_link_id;
    }

    function fromID($id) {
        $result = MySQLConnection::query("SELECT * FROM `ticket` WHERE `id` = " . $id);
        if ($result->num_rows > 0 && $row = $result->fetch_assoc()) {
            $this->id = $row['id'];
            $this->event_id = $row['event_id'];
            $this->name = $row['name'];
            $this->email_address = $row['email_address'];
            $this->contact_number = $row['contact_number'];
            $this->number_of_entries = $row['number_of_entries'];
            $this->ticket_code = $row['ticket_code'];
            $this->status = $row['status'];
            $this->payment_link = $row['payment_link'];
            $this->payment_link_id = $row['payment_link_id'];
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
        $this->event_id = $post['event_id'];
        $this->name = $post['name'];
        $this->email_address = $post['email_address'];
        $this->contact_number = $post['contact_number'];
        $this->number_of_entries = $post['number_of_entries'];
        $this->ticket_code = $post['ticket_code'];
        $this->status = $post['status'];

        // Intentionally left out payment link and link ID since this is never coming from form data
    }

    function save() {

        if ( $this->id == null ) {
            $sql = "INSERT INTO `ticket` (`event_id`, `name`, `email_address`, `contact_number`, `number_of_entries`, `ticket_code`, `status`, `payment_link`, `payment_link_id`) ".
                "VALUES(" .
                "'" . MySQLConnection::escapeString($this->event_id) . "', ".
                "'" . MySQLConnection::escapeString($this->name) . "', ".
                "'" . MySQLConnection::escapeString($this->email_address) . "', ".
                "'" . MySQLConnection::escapeString($this->contact_number) . "', ".
                "'" . MySQLConnection::escapeString($this->number_of_entries) . "', ".
                "'" . MySQLConnection::escapeString($this->ticket_code) . "', ".
                "'" . MySQLConnection::escapeString($this->status) . "', ".
                (isset($this->payment_link) ? ("'" . MySQLConnection::escapeString($this->payment_link) . "'") : "NULL") . ", ".
                (isset($this->payment_link_id) ? ("'" . MySQLConnection::escapeString($this->payment_link_id) . "'")  : "NULL") .
                ")";
        }
        else {
            $sql = "UPDATE `ticket` SET ".
                "`event_id` = '" . MySQLConnection::escapeString($this->event_id) . "', " .
                "`name` = '" . MySQLConnection::escapeString($this->name) . "', " .
                "`email_address` = '" . MySQLConnection::escapeString($this->email_address) . "', " .
                "`contact_number` = '" . MySQLConnection::escapeString($this->contact_number) . "', " .
                "`number_of_entries` = '" . MySQLConnection::escapeString($this->number_of_entries) . "', " .
                "`ticket_code` = '" . MySQLConnection::escapeString($this->ticket_code) . "', " .
                (isset($this->payment_link) ? "`payment_link` = '" . MySQLConnection::escapeString($this->payment_link) . "', " : "") .
                (isset($this->payment_link) ? "`payment_link_id` = '" . MySQLConnection::escapeString($this->payment_link_id) . "', " : "") .
                "`status` = '" . MySQLConnection::escapeString($this->status) . "' " .
                "WHERE `id` = " . $this->id;
        }
        $result = MySQLConnection::query($sql);
        if ($result) {
            if(!isset($this->id)) {
                $this->id = MySQLConnection::$lastInsertID;
            }
            return MySQLConnection::$lastInsertID;
        }
        else {
            return false;
        }
    }
}
?>