<?php

require_once('./inc/util/MySQLConnection.php');

class Domain{

    public $brand_id;
    public $domain_name;
    public $status;

    static function deleteDomain($brand_id, $domain_name) {
        $sql = "DELETE FROM `domain` WHERE `brand_id` = '" . $brand_id ."' AND `domain_name` = '" . $domain_name . "'";
        return MySQLConnection::query($sql);
    }

    static function getDomainsForBrand($brand_id) {
        $sql = "SELECT * FROM `domain` WHERE `brand_id` = '" . $brand_id . "'";
        $result = MySQLConnection::query($sql);
        if ($result->num_rows < 1) {
            return null;
        }

        $i = 0;
        while($row = $result->fetch_assoc()) {
            $domains[$i++] = new Domain(
                $row['brand_id'],
                $row['domain_name'],
                $row['status']
            );
        }
        return $domains;
    }

    function __construct(
        $brand_id = null, 
        $domain_name = null, 
        $status = null) 
    {
        $this->brand_id = $brand_id;
        $this->domain_name = $domain_name;
        $this->status = $status;
    }

    function fromFormPOST($post) {
        $this->brand_id = $_POST['brand_id'];
        $this->domain_name = $_POST['domain_name'];
        if(isset($this->status)) {
            $this->status = $_POST['status'];
        }
    }

    function fromID($brand_id, $domain_name) {
        $sql = "SELECT * FROM `domain` WHERE `brand_id` = '" . $brand_id . "' AND `domain_name` = '" . $domain_name . "'";
        $result = MySQLConnection::query($sql);
        if ($row = $result->fetch_assoc()) {
            $this->brand_id = $row['brand_id'];
            $this->domain_name = $row['domain_name'];
            $this->status = $row['status'];
        }
    }

    function save() {
        $sql = "UPDATE `domain` SET ".
            "`status` = '" . $this->status . "' " .
            "WHERE `brand_id` = '" . $this->brand_id . "' AND `domain_name` = '" . $this->domain_name . "'";
        $result = MySQLConnection::query($sql);
        if ($result) {
            return true;
        }
        else {
            return false;
        }
    }

    function saveNew() {
        $sql = "INSERT INTO `domain` (`brand_id`, `domain_name`, `status`) ".
            "VALUES(" .
            "'" . MySQLConnection::escapeString($this->brand_id) . "', ".
            "'" . MySQLConnection::escapeString($this->domain_name) . "', ".
            (isset($this->status)?("'" . MySQLConnection::escapeString($this->status) . "'"): "NULL" ).
            ")";
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