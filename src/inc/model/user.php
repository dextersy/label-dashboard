<?php

require_once('./inc/util/MySQLConnection.php');

class User{

    public $id;
    public $username;
    public $password_md5;
    public $email_address;
    public $first_name;
    public $last_name;
    public $profile_photo;
    public $is_admin;

    function __construct(
        $id = null, 
        $username = null, 
        $password_md5 = null, 
        $email_address= null, 
        $first_name= null, 
        $last_name= null, 
        $profile_photo= null, 
        $is_admin= false
    ) 
    {
        $this->id = $id;
        $this->username = $username;
        $this->password_md5 = $password_md5;
        $this->email_address = $email_address;
        $this->first_name = $first_name;
        $this->last_name = $last_name;
        $this->profile_photo = $profile_photo;
        $this->is_admin = $is_admin;
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
        }
    }

    function fromUsername($user) {
        $result = MySQLConnection::query("SELECT `id` FROM `user` WHERE `username` = '" . $user . "'");
        if ($row = $result->fetch_assoc()) {
            $this->fromID($row['id']);
            return true;
        }
        else {
            return false;
        }
    }

    function fromEmailAddress($email) {

        $result = MySQLConnection::query("SELECT `id` FROM `user` WHERE `email_address` = '" . $email . "'");
        if ($row = $result->fetch_assoc()) {
            $this->fromID($row['id']);
            return true;
        }
        else {
            return false;
        }
    }

    function fromFormPOST($post) {
        $this->id = $_POST['id'];
        $this->username = $_POST['username'];
        if ($_POST['password']) {
            $this->password_md5 = md5($_POST['password']);
        }
        $this->email_address = $_POST['email_address'];
        $this->first_name = $_POST['first_name'];
        $this->last_name = $_POST['last_name'];
        $this->profile_photo = $_POST['profile_photo'];
        $this->is_admin = $_POST['is_admin'];
    }

    function save() {

        if ( $this->id == null ) {
            $sql = "INSERT INTO `user` (`username`, `password_md5`, `email_address`, `first_name`, `last_name`, `profile_photo`, `is_admin`) ".
                "VALUES(" .
                "'" . $this->username . "', ".
                "'" . $this->password_md5 . "', ".
                "'" . $this->email_address . "', ".
                "'" . $this->first_name . "', ".
                "'" . $this->last_name . "', " .
                "'" . $this->profile_photo . "', " .
                "'" . (($this->is_admin != '') ? $this->is_admin : "0") . "'" .
                ")";
        }
        else {
            $sql = "UPDATE `user` SET ".
                "`username` = '" . $this->username . "', " .
                "`password_md5` = '" . $this->password_md5 . "', " .
                "`email_address` = '" . $this->email_address . "', " .
                "`first_name` = '" . $this->first_name . "', " .
                "`last_name` = '" . $this->last_name . "', " .
                "`profile_photo` = '" . $this->profile_photo . "', " .
                "`is_admin` = '" . $this->is_admin . "' " .
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