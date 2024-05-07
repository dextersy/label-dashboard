<?php
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/artist.php');

class UserViewItem {
    public $id;
    public $username;
    public $first_name;
    public $last_name;
    public $email_address;
    public $last_logged_in;
    public $is_admin;

    function __construct($id,$username,$first_name,$last_name,$email_address,$last_logged_in,$is_admin){
        $this->id = $id;
        $this->username = $username;
        $this->first_name = $first_name;
        $this->last_name = $last_name;
        $this->email_address = $email_address;
        $this->last_logged_in = $last_logged_in;
        $this->is_admin = $is_admin;
    }
}

function getAllActiveUsers($brand_id){
    $result = MySQLConnection::query("SELECT * FROM `user` WHERE `brand_id`='" . $brand_id ."' AND `username` <> '' ORDER BY `last_name`, `first_name` ASC");
    if ($result->num_rows < 1) {
        return null;
    }
    
    $i = 0;
    while($row = $result->fetch_assoc()) {
        $result_login = MySQLConnection::query("SELECT `date_and_time` FROM `login_attempt` WHERE `user_id`='" . $row['id'] ."' ORDER BY `date_and_time` DESC LIMIT 0,1");
        $row_login = $result_login->fetch_assoc();
        $users[$i++] = new UserViewItem(
            $row['id'],
            $row['username'],
            $row['first_name'],
            $row['last_name'],
            $row['email_address'],
            $row_login['date_and_time'],
            $row['is_admin']
        );
    }
    return $users;
}

?>