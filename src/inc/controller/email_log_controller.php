<?php
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/emailattempt.php');

function getAllEmailAttempts($brand_id, $limit=null){
    $query = "SELECT * FROM `email_attempt` WHERE `brand_id`='" . $brand_id ."' ORDER BY `timestamp` DESC";
    if(isset($limit)) {
        $query = $query . " LIMIT 0, " . $limit;
    }
    $result = MySQLConnection::query($query);
    if ($result->num_rows < 1) {
        return null;
    }
    
    $i = 0;
    while($row = $result->fetch_assoc()) {
        $emailAttempts[$i] = new EmailAttempt;
        $emailAttempts[$i]->fromDBRow($row);
        $i++;
    }
    return $emailAttempts;
}

?>