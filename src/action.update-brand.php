<?php
    require_once('./inc/model/brand.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/util/FileUploader.php');

    $brand = new Brand;
    $brand->fromFormPOST($_POST);
    if(isset($_FILES["logo_url"]["tmp_name"]) && $_FILES["logo_url"]["tmp_name"] != "") {
        $brand->logo_url = uploadImage($_FILES['logo_url']['name'], $_FILES['logo_url']['tmp_name']);
    }
    if(isset($_FILES['favicon_url']['tmp_name']) && $_FILES['favicon_url']['tmp_name'] != "") {
        $brand->favicon_url = convertPngToIco($_FILES['favicon_url']['tmp_name']);
    }
    $result = $brand->save();

    $_SESSION['brand_name'] = $brand->brand_name;
    $_SESSION['brand_logo'] = $brand->logo_url;
    $_SESSION['brand_favicon'] = $brand->favicon_url;
    $_SESSION['brand_color'] = $brand->brand_color;
    
    redirectTo("/admin.php?action=update&status=" . ($result ? "OK":"Failed"));
?>