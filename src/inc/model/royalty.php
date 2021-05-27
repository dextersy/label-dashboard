<?php

require_once('./inc/util/MySQLConnection.php');

class Royalty{

    public $id;
    public $artist_id;
    public $earning_id;
    public $percentage_of_earning;
    public $amount;
    public $release_id;
    public $description;
    public $date_recorded;
    
    function __construct(
        $id = null, 
        $artist_id = null, 
        $earning_id = null, 
        $percentage_of_earning= null, 
        $amount= null, 
        $release_id= null, 
        $description= null,
        $date_recorded = null
    ) 
    {
        $this->id = $id;
        $this->artist_id = $artist_id;
        $this->earning_id = $earning_id;
        $this->percentage_of_earning = $percentage_of_earning;
        $this->amount = $amount;
        $this->release_id = $release_id;
        $this->description = $description;
        $this->date_recorded = $date_recorded;
      }

    function fromID($id) {
        $result = MySQLConnection::query("SELECT * FROM `royalty` WHERE `id` = " . $id);
        if ($row = $result->fetch_assoc()) {
            $this->id = $row['id'];
            $this->artist_id = $row['artist_id'];
            $this->earning_id = $row['earning_id'];
            $this->percentage_of_earning = $row['percentage_of_earning'];
            $this->amount = $row['amount'];
            $this->release_id = $row['release_id'];
            $this->description = $row['description'];
            $this->date_recorded = $row['date_recorded'];
        }
    }

    function fromFormPOST($post) {
        $this->id = $post['id'];
        $this->artist_id = $post['artist_id'];
        $this->earning_id = $post['earning_id'];
        $this->percentage_of_earning = $post['percentage_of_earning'];
        $this->amount = $post['amount'];
        if ($post['release_id']=='0') {
            $this->release_id = null;
        }
        else {
            $this->release_id = $post['release_id'];
        }
        $this->description = $post['description'];
    }

    function save() {

        if ( $this->id == null ) {
            $sql = "INSERT INTO `royalty` (`artist_id`, `earning_id`, `percentage_of_earning`, `amount`, `release_id`, `description`, `date_recorded`) ".
                "VALUES(" .
                "'" . $this->artist_id . "', ".
                (($this->earning_id != null) ? $this->earning_id : 'NULL') . ", ".
                (($this->percentage_of_earning != null) ? $this->percentage_of_earning : 'NULL') . ", ".
                "'" . $this->amount . "', ".
                (($this->release_id != null) ? $this->release_id : 'NULL') . ", ".
                "'" . $this->description . "', " .
                "CURDATE()".
                ")";
        }
        else {
            $sql = "UPDATE `royalty` SET ".
                "`artist_id` = '" . $this->artist_id . "', " .
                "`earning_id` = '" . $this->earning_id . "', " .
                "`percentage_of_earning` = '" . $this->percentage_of_earning . "', " .
                "`amount` = '" . $this->amount . "', " .
                "`release_id` = '" . $this->release_id . "', " .
                "`description` = '" . $this->description . "', " .
                "`date_recorded` = '" . $this->date_recorded . "' " .
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