<?php

require_once('./inc/util/MySQLConnection.php');

class Ticket {
    public $id;
    public $event_id;
    public $name;
    public $email_address;
    public $contact_number;
    public $number_of_entries;
    public $number_of_claimed_entries;
    public $ticket_code;
    public $status;
    public $payment_link;
    public $payment_link_id;
    public $price_per_ticket;
    public $payment_processing_fee;
    public $referrer_id;
    public $order_timestamp;
    public $checkout_key;

    function __construct(
        $id = null, 
        $event_id = null,
        $name = null, 
        $email_address = null,
        $contact_number = null,
        $number_of_entries = null,
        $number_of_claimed_entries = null,
        $ticket_code = null,
        $status = null,
        $payment_link = null,
        $payment_link_id = null,
        $price_per_ticket = null,
        $payment_processing_fee = null,
        $referrer_id = null,
        $order_timestamp = null,
        $checkout_key = null
    ) 
    {
        $this->id = $id;
        $this->event_id = $event_id;
        $this->name = $name;
        $this->email_address = $email_address;
        $this->contact_number = $contact_number;
        $this->number_of_entries = $number_of_entries;
        $this->number_of_claimed_entries = $number_of_claimed_entries;
        $this->ticket_code = $ticket_code;
        $this->status = $status;
        $this->payment_link = $payment_link;
        $this->payment_link_id = $payment_link_id;
        $this->price_per_ticket = $price_per_ticket;
        $this->payment_processing_fee = $payment_processing_fee;
        $this->referrer_id = $referrer_id;
        $this->order_timestamp = $order_timestamp;
        $this->checkout_key = $checkout_key;
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
            $this->number_of_claimed_entries = $row['number_of_claimed_entries'];
            $this->ticket_code = $row['ticket_code'];
            $this->status = $row['status'];
            $this->payment_link = $row['payment_link'];
            $this->payment_link_id = $row['payment_link_id'];
            $this->price_per_ticket = $row['price_per_ticket'];
            $this->payment_processing_fee = $row['payment_processing_fee'];
            $this->referrer_id = $row['referrer_id'];
            $this->order_timestamp = $row['order_timestamp'];
            $this->checkout_key = $row['checkout_key'];
            return true;
        } else {
            return false;
        }
    }

    function fromPaymentLinkID($id) {
        $this->id = null;
        $result = MySQLConnection::query("SELECT * FROM `ticket` WHERE `payment_link_id` = '" . $id . "'");
        if ($result->num_rows > 0 && $row = $result->fetch_assoc()) {
            $this->id = $row['id'];
            $this->event_id = $row['event_id'];
            $this->name = $row['name'];
            $this->email_address = $row['email_address'];
            $this->contact_number = $row['contact_number'];
            $this->number_of_entries = $row['number_of_entries'];
            $this->number_of_claimed_entries = $row['number_of_claimed_entries'];
            $this->ticket_code = $row['ticket_code'];
            $this->status = $row['status'];
            $this->payment_link = $row['payment_link'];
            $this->payment_link_id = $row['payment_link_id'];
            $this->price_per_ticket = $row['price_per_ticket'];
            $this->payment_processing_fee = $row['payment_processing_fee'];
            $this->referrer_id = $row['referrer_id'];
            $this->order_timestamp = $row['order_timestamp'];
            $this->checkout_key = $row['checkout_key'];
            return true;
        } else {
            return false;
        }
    }

    function fromCheckoutKey($key) {
        $this->id = null;
        $result = MySQLConnection::query("SELECT * FROM `ticket` WHERE `checkout_key` = '" . $key . "'");
        if ($result->num_rows > 0 && $row = $result->fetch_assoc()) {
            $this->id = $row['id'];
            $this->event_id = $row['event_id'];
            $this->name = $row['name'];
            $this->email_address = $row['email_address'];
            $this->contact_number = $row['contact_number'];
            $this->number_of_entries = $row['number_of_entries'];
            $this->number_of_claimed_entries = $row['number_of_claimed_entries'];
            $this->ticket_code = $row['ticket_code'];
            $this->status = $row['status'];
            $this->payment_link = $row['payment_link'];
            $this->payment_link_id = $row['payment_link_id'];
            $this->price_per_ticket = $row['price_per_ticket'];
            $this->payment_processing_fee = $row['payment_processing_fee'];
            $this->referrer_id = $row['referrer_id'];
            $this->order_timestamp = $row['order_timestamp'];
            $this->checkout_key = $row['checkout_key'];
            return true;
        } else {
            return false;
        }
    }

    function fromEventIdAndTicketCode($event_id, $code) {
        $this->id = null;
        $result = MySQLConnection::query("SELECT * FROM `ticket` WHERE `event_id` = '" . $event_id . "' AND `ticket_code` = '" . $code . "'");
        if ($result->num_rows > 0 && $row = $result->fetch_assoc()) {
            $this->id = $row['id'];
            $this->event_id = $row['event_id'];
            $this->name = $row['name'];
            $this->email_address = $row['email_address'];
            $this->contact_number = $row['contact_number'];
            $this->number_of_entries = $row['number_of_entries'];
            $this->number_of_claimed_entries = $row['number_of_claimed_entries'];
            $this->ticket_code = $row['ticket_code'];
            $this->status = $row['status'];
            $this->payment_link = $row['payment_link'];
            $this->payment_link_id = $row['payment_link_id'];
            $this->price_per_ticket = $row['price_per_ticket'];
            $this->payment_processing_fee = $row['payment_processing_fee'];
            $this->referrer_id = $row['referrer_id'];
            $this->order_timestamp = $row['order_timestamp'];
            $this->checkout_key = $row['checkout_key'];
            return true;
        } else {
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
        $this->price_per_ticket = $post['price_per_ticket'];
        $this->number_of_entries = $post['number_of_entries'];
        if(isset($post['number_of_claimed_entries'])) {
            $this->number_of_claimed_entries = $post['number_of_claimed_entries'];
        }
        else {
            $this->number_of_claimed_entries = 0;
        }
        $this->ticket_code = $post['ticket_code'];
        $this->status = $post['status'];    
        $this->referrer_id = $post['referrer_id'];
    }

    function save() {
        if ($this->id == null) {
            $sql = "INSERT INTO `ticket` (`event_id`, `name`, `email_address`, `contact_number`, `number_of_entries`, `number_of_claimed_entries`, `ticket_code`, `status`, `payment_link`, `payment_link_id`, `price_per_ticket`, `payment_processing_fee`, `referrer_id`, `order_timestamp`, `checkout_key`) ".
                "VALUES(" .
                "'" . MySQLConnection::escapeString($this->event_id) . "', " .
                "'" . MySQLConnection::escapeString($this->name) . "', " .
                "'" . MySQLConnection::escapeString($this->email_address) . "', " .
                "'" . MySQLConnection::escapeString($this->contact_number) . "', " .
                "'" . MySQLConnection::escapeString($this->number_of_entries) . "', " .
                "'" . MySQLConnection::escapeString($this->number_of_claimed_entries) . "', " .
                "'" . MySQLConnection::escapeString($this->ticket_code) . "', " .
                "'" . MySQLConnection::escapeString($this->status) . "', " .
                (isset($this->payment_link) ? ("'" . MySQLConnection::escapeString($this->payment_link) . "'") : "NULL") . ", " .
                (isset($this->payment_link_id) ? ("'" . MySQLConnection::escapeString($this->payment_link_id) . "'")  : "NULL") . ", " .
                (isset($this->price_per_ticket) ? ("'" . MySQLConnection::escapeString($this->price_per_ticket) . "'")  : "NULL") . ", " .
                (isset($this->payment_processing_fee) ? ("'" . MySQLConnection::escapeString($this->payment_processing_fee) . "'")  : "NULL") . ", " .
                (isset($this->referrer_id) ? ("'" . MySQLConnection::escapeString($this->referrer_id) . "'")  : "NULL") . ", " .
                "NOW(), " .
                (isset($this->checkout_key) ? ("'" . MySQLConnection::escapeString($this->checkout_key) . "'") : "NULL") . ")";
        } else {
            $sql = "UPDATE `ticket` SET " .
                "`event_id` = '" . MySQLConnection::escapeString($this->event_id) . "', " .
                "`name` = '" . MySQLConnection::escapeString($this->name) . "', " .
                "`email_address` = '" . MySQLConnection::escapeString($this->email_address) . "', " .
                "`contact_number` = '" . MySQLConnection::escapeString($this->contact_number) . "', " .
                "`number_of_entries` = '" . MySQLConnection::escapeString($this->number_of_entries) . "', " .
                "`number_of_claimed_entries` = '" . MySQLConnection::escapeString($this->number_of_claimed_entries) . "', " .
                "`ticket_code` = '" . MySQLConnection::escapeString($this->ticket_code) . "', " .
                "`status` = '" . MySQLConnection::escapeString($this->status) . "' " .
                (isset($this->payment_link) ? ", `payment_link` = '" . MySQLConnection::escapeString($this->payment_link) ."'" : "") .
                (isset($this->payment_link_id) ? ", `payment_link_id` = '" . MySQLConnection::escapeString($this->payment_link_id)."'" : "") .
                (isset($this->price_per_ticket) ? ", `price_per_ticket` = '" . MySQLConnection::escapeString($this->price_per_ticket)."'" : "") .
                (isset($this->payment_processing_fee) ? ", `payment_processing_fee` = '" . MySQLConnection::escapeString($this->payment_processing_fee)."'" : "") .
                (isset($this->referrer_id) ? ", `referrer_id` = '" . MySQLConnection::escapeString($this->referrer_id)."'" : "") .
                (isset($this->checkout_key) ? ", `checkout_key` = '" . MySQLConnection::escapeString($this->checkout_key) . "' " : " ") .
                "WHERE `id` = " . $this->id;
        }

        $result = MySQLConnection::query($sql);
        if ($result) {
            if (!isset($this->id)) {
                $this->id = MySQLConnection::$lastInsertID;
            }
            return $this->id;
        } else {
            return false;
        }
    }
}

?>
