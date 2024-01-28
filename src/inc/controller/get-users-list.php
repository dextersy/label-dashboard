<?php
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/artist.php');

function getAllActiveUsers($brand_id){
    $result = MySQLConnection::query("SELECT * FROM `user` WHERE `brand_id`='" . $brand_id ."' AND `username` <> '' ORDER BY `last_name`, `first_name` ASC");
    if ($result->num_rows < 1) {
        return null;
    }
    
    $i = 0;
    while($row = $result->fetch_assoc()) {
        $users[$i++] = new User(
            $row['id'],
            $row['username'],
            null,
            $row['email_address'],
            $row['first_name'],
            $row['last_name'],
            $row['profile_photo'],
            $row['is_admin'],
            $row['brand_id'],
            null
        );
    }
    return $users;
}

?>