<?php
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/royalty.php');
require_once('./inc/model/release.php');

class RoyaltyViewItem {
    public $date_recorded;
    public $release_title;
    public $earning_description;
    public $description;
    public $amount;
}

function getRoyaltiesForArtist($artist_id){
    $sql = "SELECT `id` FROM `royalty` " .
            "WHERE `artist_id` = ". $artist_id . " ".
            "ORDER BY `date_recorded` DESC";
    $result = MySQLConnection::query($sql);
    $i = 0;
    
    while($result->num_rows > 0 && $row = $result->fetch_assoc()) {
        $royalties[$i] = new Royalty;
        $royalties[$i]->fromID($row['id']);

        $royaltyViewItems[$i] = new Royalty;
        $royaltyViewItems[$i]->date_recorded = $royalties[$i]->date_recorded;
        $royaltyViewItems[$i]->description = $royalties[$i]->description;
        $royaltyViewItems[$i]->amount = $royalties[$i]->amount;

        if ($royalties[$i]->release_id != null) {            
            $release = new Release;
            if($release->fromID($royalties[$i]->release_id)) {
                $royaltyViewItems[$i]->release_title = $release->catalog_no .": " . $release->title;        
            }
        }

        $i++;
    }
    return $royaltyViewItems;
}

?>