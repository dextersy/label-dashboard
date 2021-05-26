<?php

require_once('./inc/util/MySQLConnection.php');

class ArtistAccess{

    public $artist_id;
    public $user_id;
    public $can_view_payments;
    public $can_view_royalties;
    public $can_edit_artist_profile;
    public $status;
    public $invite_hash;

    function __construct(
        $artist_id = null, 
        $user_id = null, 
        $can_view_payments = null, 
        $can_view_royalties= null, 
        $can_edit_artist_profile= null, 
        $status= null,
        $invite_hash= null
    ) 
    {
        $this->artist_id = $artist_id;
        $this->user_id = $user_id;
        $this->can_view_payments = $can_view_payments;
        $this->can_view_royalties = $can_view_royalties;
        $this->can_edit_artist_profile = $can_edit_artist_profile;
        $this->status = $status;
        $this->invite_hash = $invite_hash;
    }


    function fromID($artist_id, $user_id) {
        $result = MySQLConnection::query("SELECT * FROM `artist_access` WHERE `artist_id` = " . $artist_id . " AND `user_id` = " . $user_id);
        if ($result->num_rows > 0 && $row = $result->fetch_assoc()) {
            $this->artist_id = $artist_id;
            $this->user_id = $user_id;
            $this->can_view_payments = $row['can_view_payments'];
            $this->can_view_royalties = $row['can_view_royalties'];
            $this->can_edit_artist_profile = $row['can_edit_artist_profile'];
            $this->status = $row['status'];
            $this->invite_hash = $row['invite_hash'];
            return true;
        }
        return false;
    }

    function fromInviteHash($hash) {
        $result = MySQLConnection::query($sql = "SELECT `artist_id`, `user_id` FROM `artist_access` WHERE `invite_hash` = '" . $hash . "'");
        if ($row = $result->fetch_assoc()) {
            $this->fromID($row['artist_id'], $row['user_id']);
            return true;
        }
        else {
            return false;
        }
    }

    function saveNew() {
        $sql = "INSERT INTO `artist_access` (`artist_id`, `user_id`, `can_view_payments`, `can_view_royalties`, `can_edit_artist_profile`, `status`, `invite_hash`) ".
                    "VALUES(" .
                    "'" . $this->artist_id . "', ".
                    "'" . $this->user_id . "', ".
                    "'" . $this->can_view_payments . "', ".
                    "'" . $this->can_view_royalties . "', ".
                    "'" . $this->can_edit_artist_profile . "', " .
                    "'" . $this->status . "', " .
                    "'" . $this->invite_hash . "'" .
                    ")";
        $result = MySQLConnection::query($sql);
        if ($result) {
            return true;
        }
        else {
            return false;
        }
    }

    function saveUpdates() {
        $sql = "UPDATE `artist_access` SET ".
                "`can_view_payments` = '" . $this->can_view_payments . "', " .
                "`can_view_royalties` = '" . $this->can_view_royalties . "', " .
                "`can_edit_artist_profile` = '" . $this->can_edit_artist_profile . "', " .
                "`status` = '" . $this->status . "', " .
                "`invite_hash` = '" . $this->invite_hash . "' ".
                "WHERE `artist_id` = '" . $this->artist_id . "' AND `user_id` = '" . $this->user_id . "'";
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