<?php
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/event.php');

function getAllEvents($brand_id){
    $result = MySQLConnection::query("SELECT * FROM `event` WHERE `brand_id`='" . $brand_id ."' ORDER BY `date_and_time` DESC");
    if ($result->num_rows < 1) {
        return null;
    }
    
    $i = 0;
    while($row = $result->fetch_assoc()) {
        $events[$i++] = new Event(
            $row['id'],
            $row['brand_id'],
            $row['title'],
            $row['date_and_time'],
            $row['description'],
            $row['poster_url'],
            $row['venue']
        );
    }
    return $events;
}

?>