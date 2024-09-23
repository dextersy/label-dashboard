<?php

require_once('./inc/util/MySQLConnection.php');

class Brand {
    public $id;
    public $brand_name;
    public $logo_url;
    public $favicon_url;
    public $brand_color;
    public $brand_website;
    public $release_submission_url;
    public $catalog_prefix;
    public $parent_brand;
    public $paymongo_wallet_id;
    public $payment_processing_fee_for_payouts;

    function __construct(
        $id = null, 
        $brand_name = null, 
        $logo_url = null, 
        $favicon_url = null, 
        $brand_color = null,
        $brand_website = null,
        $release_submission_url = null,
        $catalog_prefix = null,
        $parent_brand = null,
        $paymongo_wallet_id = null,
        $payment_processing_fee_for_payouts = null
    ) 
    {
        $this->id = $id;
        $this->brand_name = $brand_name;
        $this->logo_url = $logo_url;
        $this->favicon_url = $favicon_url;
        $this->brand_color = $brand_color;
        $this->brand_website = $brand_website;
        $this->release_submission_url = $release_submission_url;
        $this->catalog_prefix = $catalog_prefix;
        $this->parent_brand = $parent_brand;
        $this->paymongo_wallet_id = $paymongo_wallet_id;
        $this->payment_processing_fee_for_payouts = $payment_processing_fee_for_payouts;
    }

    function fromID($id) {
        $result = MySQLConnection::query("SELECT * FROM `brand` WHERE `id` = " . $id);
        if ($result->num_rows > 0 && $row = $result->fetch_assoc()) {
            $this->id = $id;
            $this->brand_name = $row['brand_name'];
            $this->logo_url = $row['logo_url'];
            $this->favicon_url = $row['favicon_url'];
            $this->brand_color = $row['brand_color'];
            $this->brand_website = $row['brand_website'];
            $this->release_submission_url = $row['release_submission_url'];
            $this->catalog_prefix = $row['catalog_prefix'];
            $this->parent_brand = $row['parent_brand']; 
            $this->paymongo_wallet_id = $row['paymongo_wallet_id'];
            $this->payment_processing_fee_for_payouts = $row['payment_processing_fee_for_payouts'];
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
        if(isset($_POST['favicon_url'])) {
            $this->favicon_url = $_POST['favicon_url'];
        }
        $this->brand_color = $_POST['brand_color'];
        $this->brand_website = $_POST['brand_website'];

        if(isset($_POST['release_submission_url'])) {
            $this->release_submission_url = $_POST['release_submission_url'];
        }
        if(isset($_POST['catalog_prefix'])) {
            $this->catalog_prefix = $_POST['catalog_prefix'];
        }
        if(isset($_POST['parent_brand'])) {
            $this->parent_brand = $_POST['parent_brand'];
        }
        if(isset($_POST['paymongo_wallet_id'])) {
            $this->paymongo_wallet_id = $_POST['paymongo_wallet_id'];
        }
        if(isset($_POST['payment_processing_fee_for_payouts'])) {
            $this->payment_processing_fee_for_payouts = $_POST['payment_processing_fee_for_payouts'];
        }
    }

    function save() {
        if ($this->id == null ) {
            $sql = "INSERT INTO `brand` (`name`, `logo_url`, `favicon_url`, `brand_color`, `brand_website`, `release_submission_url`, `catalog_prefix`, `parent_brand`, `paymongo_wallet_id`, `payment_processing_fee_for_payouts`) ".
                "VALUES(" .
                "'" . MySQLConnection::escapeString($this->brand_name) . "', ".
                "'" . MySQLConnection::escapeString($this->logo_url) . "', " .
                "'" . MySQLConnection::escapeString($this->favicon_url) . "', " .
                "'" . MySQLConnection::escapeString($this->brand_color) . "', " .
                "'" . MySQLConnection::escapeString($this->brand_website) . "', " .
                "'" . MySQLConnection::escapeString($this->release_submission_url) . "', " .
                "'" . MySQLConnection::escapeString($this->catalog_prefix) . "', " .
                "'" . MySQLConnection::escapeString($this->parent_brand) . "', " .
                "'" . MySQLConnection::escapeString($this->paymongo_wallet_id) . "', " .
                "'" . MySQLConnection::escapeString($this->payment_processing_fee_for_payouts) . "'" .
                ")";
        }
        else {
            $sql = "UPDATE `brand` SET ".
                "`brand_name` = '" . MySQLConnection::escapeString($this->brand_name) . "', " .
                (isset($this->logo_url) ?  "`logo_url` = '" . MySQLConnection::escapeString($this->logo_url) . "', " : "") .
                (isset($this->favicon_url) ?  "`favicon_url` = '" . MySQLConnection::escapeString($this->favicon_url) . "', " : "") .
                "`brand_color` = '" . MySQLConnection::escapeString($this->brand_color) . "', " .
                "`brand_website` = '" . MySQLConnection::escapeString($this->brand_website) . "', " .
                "`release_submission_url` = '" . MySQLConnection::escapeString($this->release_submission_url) . "', " .
                "`catalog_prefix` = '" . MySQLConnection::escapeString($this->catalog_prefix) . "'" .
                (isset($this->parent_brand) ?  ", " . "`parent_brand` = '" . MySQLConnection::escapeString($this->parent_brand) . "' " : " ") .
                ", `paymongo_wallet_id` = '" . MySQLConnection::escapeString($this->paymongo_wallet_id) . "', " .
                "`payment_processing_fee_for_payouts` = '" . MySQLConnection::escapeString($this->payment_processing_fee_for_payouts) . "' " .
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
