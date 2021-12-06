<?php

require_once('./inc/util/MySQLConnection.php');

class Brand{

    public $id;
    public $brand_name;
    public $logo_url;
    public $brand_color;

    function __construct(
        $id = null, 
        $brand_name = null, 
        $logo_url = null, 
        $brand_color= null) 
    {
        $this->id = $id;
        $this->brand_name = $brand_name;
        $this->logo_url = $logo_url;
        $this->brand_color = $brand_color;
    }

    function fromID($id) {
        $result = MySQLConnection::query("SELECT * FROM `brand` WHERE `id` = " . $id);
        if ($result->num_rows > 0 && $row = $result->fetch_assoc()) {
            $this->id = $id;
            $this->brand_name = $row['brand_name'];
            $this->logo_url = $row['logo_url'];
            $this->brand_color = $row['brand_color'];
        }
    }

    function fromFormPOST($post) {
        if (isset($_POST['id'])) {
            $this->id = $_POST['id'];
            $this->fromID($this->id);
        }
        $this->brand_name = $_POST['brand_name'];
        $this->logo_url = $_POST['logo_url'];
        $this->brand_color = $_POST['brand_color'];
    }

    function save() {

        if ( $this->id == null ) {
            $sql = "INSERT INTO `brand` (`name`, `logo_url`, `brand_color`) ".
                "VALUES(" .
                "'" . MySQLConnection::escapeString($this->brand_name) . "', ".
                "'" . MySQLConnection::escapeString($this->logo_url) . "', " .
                "'" . MySQLConnection::escapeString($this->brand_color) . "'" .
                ")";
        }
        else {
            $sql = "UPDATE `brand` SET ".
                "`name` = '" . MySQLConnection::escapeString($this->brand_name) . "', " .
                "`logo_url` = '" . MySQLConnection::escapeString($this->logo_url) . "', " .
                "`brand_color` = '" . MySQLConnection::escapeString($this->brand_color) . "' " .
                "WHERE `id` = " . $this->id;
        }
        echo $sql;
        $result = MySQLConnection::query($sql);
        if ($result) {
            if($this->id == null) {
                $this->id = MySQLConnection::$lastInsertID;
            }
            return true;
        }
        else {
            return false;
        }
    }
}
?>