<?php
    include_once('./inc/util/Redirect.php');
    include_once('./inc/model/brand.php');
    session_start();
    if ($_SESSION['brand_name'] == null) {
        $brand = findBrandByDomain($_SERVER['HTTP_HOST']);
        if ($brand != null) {
            $_SESSION['brand_id'] = $brand->id;
            $_SESSION['brand_name'] = $brand->brand_name;
            $_SESSION['brand_logo'] = $brand->logo_url;
            $_SESSION['brand_color'] = $brand->brand_color;
            $_SESSION['brand_website'] = $brand->brand_website;
        }
        else {
            redirectTo('/nobrand.php');
        }
    }

    function findBrandByDomain($domain) {
        $result = MySQLConnection::query("SELECT * FROM `brand` WHERE `id` IN (".
            "SELECT `brand_id` FROM `domain` WHERE `domain_name` LIKE '" . $domain . "'".
            ")");
        if ($result->num_rows < 1) {
            return null;
        }
        $row = $result->fetch_assoc();
        $brand = new Brand;
        $brand->fromID($row['id']);
        return $brand;
    }

?>