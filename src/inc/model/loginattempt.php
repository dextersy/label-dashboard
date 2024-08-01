<?php

require_once('./inc/util/MySQLConnection.php');

class LoginAttempt {
    public $id;
    public $user_id;
    public $status;
    public $date_and_time;
    public $brand_id;
    public $proxy_ip;
    public $remote_ip;

    function __construct(
        $id = null, 
        $user_id = null, 
        $status = null, 
        $date_and_time = null, 
        $brand_id = null, 
        $proxy_ip = null, 
        $remote_ip = null
    ) {
        $this->id = $id;
        $this->user_id = $user_id;
        $this->status = $status;
        $this->date_and_time = $date_and_time;
        $this->brand_id = $brand_id;
        $this->proxy_ip = $proxy_ip;
        $this->remote_ip = $remote_ip;
    }

    function save() {
        $sql = "INSERT INTO `login_attempt` (`user_id`, `status`, `date_and_time`, `brand_id`, `proxy_ip`, `remote_ip`) " .
               "VALUES (" .
               "'" . MySQLConnection::escapeString($this->user_id) . "', " .
               "'" . MySQLConnection::escapeString($this->status) . "', " .
               "'" . MySQLConnection::escapeString($this->date_and_time) . "', " .
               "'" . MySQLConnection::escapeString($this->brand_id) . "', " .
               "'" . MySQLConnection::escapeString($this->proxy_ip) . "', " .
               "'" . MySQLConnection::escapeString($this->remote_ip) . "'" .
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