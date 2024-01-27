<?php

require_once('./inc/util/MySQLConnection.php');

class Brand {
    public $id;
    public $brand_name;
    public $logo_url;
    public $brand_color;
    public $brand_website;
    public $release_submission_url;
    public $catalog_prefix;
    public $parent_brand;

    function __construct(
        $id = null, 
        $brand_name = null, 
        $logo_url = null, 
        $brand_color = null,
        $brand_website = null,
        $release_submission_url = null,
        $catalog_prefix = null,
        $parent_brand = null
    ) 
    {
        $this->id = $id;
        $this->brand_name = $brand_name;
        $this->logo_url = $logo_url;
        $this->brand_color = $brand_color;
        $this->brand_website = $brand_website;
        $this->release_submission_url = $release_submission_url;
        $this->catalog_prefix = $catalog_prefix;
        $this->parent_brand = $parent_brand;
    }

    function fromID($id) {
        $result = MySQLConnection::query("SELECT * FROM `brand` WHERE `id` = " . $id);
        if ($result->num_rows > 0 && $row = $result->fetch_assoc()) {
            $this->id = $id;
            $this->brand_name = $row['brand_name'];
            $this->logo_url = $row['logo_url'];
            $this->brand_color = $row['brand_color'];
            $this->brand_website = $row['brand_website'];
            $this->release_submission_url = $row['release_submission_url'];
            $this->catalog_prefix = $row['catalog_prefix'];
            $this->parent_brand = $row['parent_brand']; // Assuming 'parent_brand' is a field in the database
        }
    }

    function fromFormPOST($post) {
        if (isset($_POST['id'])) {
            $this->id = $_POST['id'];
            $this->fromID($this->id);
        }
        $this->brand_name = $_POST['brand_name'];
        if(isset($_POST['logo_url'])) {
            $this->logo_url = $_POST['logo_url'];
        }
        $this->brand_color = $_POST['brand_color'];
        $this->brand_website = $_POST['brand_website'];

        if(isset($_POST['release_submission_url'])) {
            $this->release_submission_url = $_POST['release_submission_url'];
        }
        if(isset($_POST['catalog_prefix'])) {
            $this->catalog_prefix = $_POST['catalog_prefix'];
        }
        $this->parent_brand = $_POST['parent_brand']; // Assuming 'parent_brand' is received from the form
    }

    function save() {
        if ($this->id == null ) {
            $sql = "INSERT INTO `brand` (`name`, `logo_url`, `brand_color`, `brand_website`, `release_submission_url`, `catalog_prefix`, `parent_brand`) ".
                "VALUES(" .
                "'" . MySQLConnection::escapeString($this->brand_name) . "', ".
                "'" . MySQLConnection::escapeString($this->logo_url) . "', " .
                "'" . MySQLConnection::escapeString($this->brand_color) . "', " .
                "'" . MySQLConnection::escapeString($this->brand_website) . "', " .
                "'" . MySQLConnection::escapeString($this->release_submission_url) . "', " .
                "'" . MySQLConnection::escapeString($this->catalog_prefix) . "', " .
                "'" . MySQLConnection::escapeString($this->parent_brand) . "'" .
                ")";
        }
        else {
            $sql = "UPDATE `brand` SET ".
                "`brand_name` = '" . MySQLConnection::escapeString($this->brand_name) . "', " .
                "`logo_url` = '" . MySQLConnection::escapeString($this->logo_url) . "', " .
                "`brand_color` = '" . MySQLConnection::escapeString($this->brand_color) . "', " .
                "`brand_website` = '" . MySQLConnection::escapeString($this->brand_website) . "', " .
                "`release_submission_url` = '" . MySQLConnection::escapeString($this->release_submission_url) . "', " .
                "`catalog_prefix` = '" . MySQLConnection::escapeString($this->catalog_prefix) . "', " .
                "`parent_brand` = '" . MySQLConnection::escapeString($this->parent_brand) . "' " .
                "WHERE `id` = " . $this->id;
        }
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