<?php
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/event.php');

function getAllEvents($brand_id, $limit=null){
    $query = "SELECT * FROM `event` WHERE `brand_id`='" . $brand_id ."' ORDER BY `date_and_time` DESC";
    if(isset($limit)) {
        $query = $query . " LIMIT 0, " . $limit;
    }
    $result = MySQLConnection::query($query);
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

function getNetSalesForEvent($event_id) {
    $sql = "SELECT SUM(price_per_ticket * number_of_entries - payment_processing_fee) AS `net_sales` FROM `ticket` ".
        "WHERE `event_id` = '" . $event_id . "' AND `status` = 'Ticket sent.'";
    $result = MySQLConnection::query($sql);
    if ($result->num_rows > 0 && $row = $result->fetch_assoc()) {
        return $row['net_sales'];
    }
}

?>