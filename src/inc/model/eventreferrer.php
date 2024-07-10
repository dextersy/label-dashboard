<?php

require_once('./inc/util/MySQLConnection.php');

class EventReferrer {
    public $id;
    public $name;
    public $referral_code;
    public $event_id;

    function __construct(
        $id = null,
        $name = null,
        $referral_code = null,
        $event_id = null
    ) {
        $this->id = $id;
        $this->name = $name;
        $this->referral_code = $referral_code;
        $this->event_id = $event_id;
    }

    function fromID($id) {
        $result = MySQLConnection::query("SELECT * FROM `event_referrer` WHERE `id` = " . $id);
        if ($result->num_rows > 0 && $row = $result->fetch_assoc()) {
            $this->id = $row['id'];
            $this->name = $row['name'];
            $this->referral_code = $row['referral_code'];
            $this->event_id = $row['event_id'];
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
        $this->name = $post['name'];
        $this->referral_code = $post['referral_code'];
        $this->event_id = $post['event_id'];
    }

    function save() {
        if ($this->id == null) {
            $sql = "INSERT INTO `event_referrer` (`name`, `referral_code`, `event_id`) ".
                "VALUES(" .
                "'" . MySQLConnection::escapeString($this->name) . "', " .
                "'" . MySQLConnection::escapeString($this->referral_code) . "', " .
                "'" . MySQLConnection::escapeString($this->event_id) . "'" .
                ")";
        } else {
            $sql = "UPDATE `event_referrer` SET " .
                "`name` = '" . MySQLConnection::escapeString($this->name) . "', " .
                "`referral_code` = '" . MySQLConnection::escapeString($this->referral_code) . "', " .
                "`event_id` = '" . MySQLConnection::escapeString($this->event_id) . "' " .
                "WHERE `id` = " . $this->id;
        }
        $result = MySQLConnection::query($sql);
        if ($result) {
            if (!isset($this->id)) {
                $this->id = MySQLConnection::$lastInsertID;
            }
            return MySQLConnection::$lastInsertID;
        } else {
            return false;
        }
    }
}


?>