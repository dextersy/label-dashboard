<?php

require_once('./inc/util/MySQLConnection.php');

class EmailAttempt {
    public $id;
    public $recipients;
    public $subject;
    public $body;
    public $timestamp;
    public $result;
    public $brand_id;

    function __construct(
        $id = null, 
        $recipients = null, 
        $subject = null, 
        $body = null, 
        $timestamp = null, 
        $result = null, 
        $brand_id = null
    ) {
        $this->id = $id;
        $this->recipients = $recipients;
        $this->subject = $subject;
        $this->body = $body;
        $this->timestamp = $timestamp;
        $this->result = $result;
        $this->brand_id = $brand_id;
    }

    function fromID($id) {
        $result = MySQLConnection::query("SELECT * FROM `email_attempt` WHERE `id` = " . $id);
        if ($result->num_rows > 0 && $row = $result->fetch_assoc()) {
            $this->id = $row['id'];
            $this->recipients = $row['recipients'];
            $this->subject = $row['subject'];
            $this->body = $row['body'];
            $this->timestamp = $row['timestamp'];
            $this->result = $row['result'];
            $this->brand_id = $row['brand_id'];
            return true;
        }
        else {
            return false;
        }
        
    }

    function fromDBRow($row) {
        $this->id = $row['id'];
        $this->recipients = $row['recipients'];
        $this->subject = $row['subject'];
        $this->body = $row['body'];
        $this->timestamp = $row['timestamp'];
        $this->result = $row['result'];
        $this->brand_id = $row['brand_id'];
    }

    function save() {
        $sql = "INSERT INTO `email_attempt` (`recipients`, `subject`, `body`, `timestamp`, `result`, `brand_id`) " .
               "VALUES (" .
               "'" . MySQLConnection::escapeString($this->recipients) . "', " .
               "'" . MySQLConnection::escapeString($this->subject) . "', " .
               "'" . MySQLConnection::escapeString($this->body) . "', " .
               "NOW(), " .
               "'" . MySQLConnection::escapeString($this->result) . "', " .
               "'" . MySQLConnection::escapeString($this->brand_id) . "'" .
               ")";
        $result = MySQLConnection::query($sql);
        if ($result) {
            if ($this->id === null) {
                $this->id = MySQLConnection::$lastInsertID;
            }
            return true;
        } else {
            return false;
        }
    }
}

?>