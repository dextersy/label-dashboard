<?php

function uploadImage($file) {
    $target_dir = "uploads/";
    $target_file = $target_dir . basename($file["name"]);
    $imageFileType = strtolower(pathinfo($target_file, PATHINFO_EXTENSION));
    
    $check = getimagesize($file["tmp_name"]);
    if($check !== false) {
        $i = 0;
        while(file_exists($target_file)) {
            $target_file = $target_dir . basename($file["name"]) . "_" . $i;
            $i++;
        }
        if(move_uploaded_file($file["tmp_name"], $target_file)) {
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
?>