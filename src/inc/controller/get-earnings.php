<?php
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/earning.php');
require_once('./inc/model/release.php');

class EarningViewItem {
    public $date_recorded;
    public $release_title;
    public $earning_description;
    public $description;
    public $amount;
}

function getEarningsForArtist($artist_id, $start = 0, $limit = -1){
    $sql = "SELECT `id` FROM `earning` " .
            "WHERE `release_id` IN (SELECT `release_id` FROM `release_artist` WHERE `artist_id` = '". $artist_id . "') ".
            "ORDER BY `date_recorded` DESC";
    if ($limit >= 0) {
        $sql = $sql . " LIMIT ". $start .", " . $limit;
    }
    $result = MySQLConnection::query($sql);
    $i = 0;
    
    while($result->num_rows > 0 && $row = $result->fetch_assoc()) {
        $earnings[$i] = new Earning;
        $earnings[$i]->fromID($row['id']);

        $earningViewItems[$i] = new EarningViewItem;
        $earningViewItems[$i]->date_recorded = $earnings[$i]->date_recorded;
        $earningViewItems[$i]->description = $earnings[$i]->description;
        $earningViewItems[$i]->amount = $earnings[$i]->amount;

        if ($earnings[$i]->release_id != null) {            
            $release = new Release;
            if($release->fromID($earnings[$i]->release_id)) {
                $earningViewItems[$i]->release_title = $release->catalog_no .": " . $release->title;        
            }
        }

        $i++;
    }
    return $earningViewItems;
}

function getTotalEarningsForArtist($artist_id, $start_date = null, $end_date = null){
    $sql = "SELECT SUM(`amount`) AS `total_earning` FROM `earning` " .
            "WHERE `release_id` IN (SELECT `release_id` FROM `release_artist` WHERE `artist_id` = '". $artist_id ."')";
    if($start_date != null && $end_date != null) {
        $sql = $sql . " AND `date_recorded` BETWEEN '" . $start_date . "' AND '" . $end_date . "'";
    }
    $result = MySQLConnection::query($sql);
    if($result->num_rows > 0 && $row = $result->fetch_assoc()) {
        $totalEarnings = $row['total_earning'];
    }
    return $totalEarnings;
}

function getTotalEarningsForRelease($release_id, $start_date = null, $end_date = null){
    $sql = "SELECT SUM(`amount`) AS `total_earning` FROM `earning` " .
            "WHERE `release_id` = " . $release_id;
    if($start_date != null && $end_date != null) {
        $sql = $sql . " AND `date_recorded` BETWEEN '" . $start_date . "' AND '" . $end_date . "'";
    }
    $result = MySQLConnection::query($sql);
    if($result->num_rows > 0 && $row = $result->fetch_assoc()) {
        $totalEarnings = $row['total_earning'];
    }
    return $totalEarnings;
}

?>