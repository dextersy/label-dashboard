<?php

require_once('./inc/util/MySQLConnection.php');

class EventReferrer {
    public $id;
    public $name;
    public $referral_code;
    public $event_id;
    public $referral_shortlink;

    function __construct(
        $id = null,
        $name = null,
        $referral_code = null,
        $event_id = null,
        $referral_shortlink = null
    ) {
        $this->id = $id;
        $this->name = $name;
        $this->referral_code = $referral_code;
        $this->event_id = $event_id;
        $this->referral_shortlink = $referral_shortlink;
    }

    function fromID($id) {
        $result = MySQLConnection::query("SELECT * FROM `event_referrer` WHERE `id` = " . $id);
        if ($result->num_rows > 0 && $row = $result->fetch_assoc()) {
            $this->id = $row['id'];
            $this->name = $row['name'];
            $this->referral_code = $row['referral_code'];
            $this->event_id = $row['event_id'];
            $this->referral_shortlink = $row['referral_shortlink']; 
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
        if(isset($post['referral_shortlink'])) {
            $this->referral_shortlink = $post['referral_shortlink'];
        }
    }

    function save() {
        if ($this->id == null) {
            $sql = "INSERT INTO `event_referrer` (`name`, `referral_code`, `event_id`, `referral_shortlink`) " .
                "VALUES(" .
                "'" . MySQLConnection::escapeString($this->name) . "', " .
                "'" . MySQLConnection::escapeString($this->referral_code) . "', " .
                "'" . MySQLConnection::escapeString($this->event_id) . "', " .
                "'" . MySQLConnection::escapeString($this->referral_shortlink) . "'" .
                ")";
        } else {
            $sql = "UPDATE `event_referrer` SET " .
                "`name` = '" . MySQLConnection::escapeString($this->name) . "', " .
                "`referral_code` = '" . MySQLConnection::escapeString($this->referral_code) . "', " .
                "`event_id` = '" . MySQLConnection::escapeString($this->event_id) . "', " .
                "`referral_shortlink` = '" . MySQLConnection::escapeString($this->referral_shortlink) . "' " .
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