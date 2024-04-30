<?php

require_once('./inc/util/MySQLConnection.php');

class User {

    public $id;
    public $username;
    public $password_md5;
    public $email_address;
    public $first_name;
    public $last_name;
    public $profile_photo;
    public $is_admin;
    public $brand_id;
    public $reset_hash;

    function __construct(
        $id = null, 
        $username = null, 
        $password_md5 = null, 
        $email_address = null, 
        $first_name = null, 
        $last_name = null, 
        $profile_photo = null, 
        $is_admin = false,
        $brand_id = null,
        $reset_hash = null
    ) {
        $this->id = $id;
        $this->username = $username;
        $this->password_md5 = $password_md5;
        $this->email_address = $email_address;
        $this->first_name = $first_name;
        $this->last_name = $last_name;
        $this->profile_photo = $profile_photo;
        $this->is_admin = $is_admin;
        $this->brand_id = $brand_id;
        $this->reset_hash = $reset_hash;
    }

    function fromID($id) {
        $result = MySQLConnection::query("SELECT * FROM `user` WHERE `id` = " . $id);
        if ($row = $result->fetch_assoc()) {
            $this->id = $id;
            $this->username = $row['username'];
            $this->password_md5 = $row['password_md5'];
            $this->email_address = $row['email_address'];
            $this->first_name = $row['first_name'];
            $this->last_name = $row['last_name'];
            $this->profile_photo = $row['profile_photo'];
            $this->is_admin = $row['is_admin'];
            $this->brand_id = $row['brand_id'];
            $this->reset_hash = $row['reset_hash'];
        }
    }

    function fromUsername($brand_id, $user) {
        $result = MySQLConnection::query("SELECT `id` FROM `user` WHERE `username` = '" . $user . "' AND `brand_id` = '" . $brand_id . "'");
        if ($result->num_rows > 0 && $row = $result->fetch_assoc()) {
            $this->fromID($row['id']);
            return true;
        } else {
            return false;
        }
    }

    function fromEmailAddress($brand_id, $email) {
        $result = MySQLConnection::query("SELECT `id` FROM `user` WHERE `email_address` = '" . $email . "' AND `brand_id` = '" . $brand_id . "'");
        if ($result->num_rows > 0 && $row = $result->fetch_assoc()) {
            $this->fromID($row['id']);
            return true;
        } else {
            return false;
        }
    }

    function fromResetHash($brand_id, $reset_hash) {
        $result = MySQLConnection::query("SELECT `id` FROM `user` WHERE `reset_hash` = '" . $reset_hash . "' AND `brand_id` = '" . $brand_id . "'");
        if ($result->num_rows > 0 && $row = $result->fetch_assoc()) {
            $this->fromID($row['id']);
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
        $this->username = isset($_POST['username']) ? $_POST['username'] : $this->username;
        if ($_POST['password']) {
            $this->password_md5 = md5($_POST['password']);
        }
        $this->email_address = isset($_POST['email_address']) ? $_POST['email_address'] : $this->email_address;
        $this->first_name = isset($_POST['first_name']) ? $_POST['first_name'] : $this->first_name;
        $this->last_name = isset($_POST['last_name']) ? $_POST['last_name'] : $this->last_name;
        $this->profile_photo = isset($_POST['profile_photo']) ? $_POST['profile_photo'] : $this->profile_photo;
        $this->is_admin = isset($_POST['is_admin']) ? $_POST['is_admin'] : $this->is_admin;
        $this->brand_id = isset($_POST['brand_id']) ? $_POST['brand_id'] : $this->brand_id;
        $this->reset_hash = isset($_POST['reset_hash']) ? $_POST['reset_hash'] : $this->reset_hash;
    }

    function save() {
        if ($this->id == null) {
            $sql = "INSERT INTO `user` (`username`, `password_md5`, `email_address`, `first_name`, `last_name`, `profile_photo`, `is_admin`, `brand_id`, `reset_hash`) " .
                "VALUES(" .
                "'" . MySQLConnection::escapeString($this->username) . "', " .
                "'" . MySQLConnection::escapeString($this->password_md5) . "', " .
                "'" . MySQLConnection::escapeString($this->email_address) . "', " .
                "'" . MySQLConnection::escapeString($this->first_name) . "', " .
                "'" . MySQLConnection::escapeString($this->last_name) . "', " .
                "'" . MySQLConnection::escapeString($this->profile_photo) . "', " .
                "'" . (($this->is_admin != '') ? MySQLConnection::escapeString($this->is_admin) : "0") . "', " .
                "'" . MySQLConnection::escapeString($this->brand_id) . "', " .
                ((isset($this->reset_hash)) ? "'" . MySQLConnection::escapeString($this->reset_hash) . "'" : "NULL") .
                ")";
        } else {
            $sql = "UPDATE `user` SET " .
                "`username` = '" . MySQLConnection::escapeString($this->username) . "', " .
                "`email_address` = '" . MySQLConnection::escapeString($this->email_address) . "', " .
                "`first_name` = '" . MySQLConnection::escapeString($this->first_name) . "', " .
                "`last_name` = '" . MySQLConnection::escapeString($this->last_name) . "', " .
                "`profile_photo` = '" . MySQLConnection::escapeString($this->profile_photo) . "', " .
                "`is_admin` = '" . (($this->is_admin != '') ? MySQLConnection::escapeString($this->is_admin) : "0") . "', " .
                "`brand_id` = '" . MySQLConnection::escapeString($this->brand_id) . "', " .
                "`reset_hash` = " . ((isset($this->reset_hash)) ? "'" . MySQLConnection::escapeString($this->reset_hash) . "'" : "NULL") . " " .
                "WHERE `id` = " . MySQLConnection::escapeString($this->id);
        }
        $result = MySQLConnection::query($sql);
        if ($result) {
            if ($this->id == null) {
                $this->id = MySQLConnection::$lastInsertID;
            }
            if (isset($this->password_md5)) {
                $sql = "UPDATE `user` SET " .
                    "`password_md5` = '" . MySQLConnection::escapeString($this->password_md5) . "' " .
                    "WHERE `id` = " . MySQLConnection::escapeString($this->id);
                $result = MySQLConnection::query($sql);
                return $result ? true : false;
            }
        }
        return false;
    }
}
?>
