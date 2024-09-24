<?php

require_once( './vendor/class-php-ico.php' );

function uploadImage($filename, $tempname) {
    $target_dir = "uploads/";
    $target_file = $target_dir . basename($filename);
    $imageFileType = strtolower(pathinfo($target_file, PATHINFO_EXTENSION));
    
    $check = getimagesize($tempname);
    if($check !== false) {
        $i = 0;
        while(file_exists($target_file)) {
            $target_file = $target_dir . basename($filename) . "_" . $i;
            $i++;
        }
        if(move_uploaded_file($tempname, $target_file)) {
            return $target_file;
        }
        else {
            echo "Failed to copy file";
        }
    } else {
        echo "Failed to get image size.";
        return null;
    }
}

function uploadDocument($file) {
    $target_dir = "uploads/";
    $target_file = $target_dir . basename($file["name"]);
    $imageFileType = strtolower(pathinfo($target_file, PATHINFO_EXTENSION));
    
    $i = 0;
    while(file_exists($target_file)) {
        $target_file = $target_dir . basename($file["name"]) . "_" . $i;
        $i++;
    }
    if(move_uploaded_file($file["tmp_name"], $target_file)) {
        return $target_file;
    }
    else {
        return null;
    }
}

function convertPngToIco($filename) {
    $source = $filename;
    $destination = "uploads/" . basename($filename, '.png') . '.ico';

    $ico_lib = new PHP_ICO( $source );
    if($ico_lib->save_ico( $destination )) {
        return $destination;
    }
    else {
        return "";
    }
}
?>