<?php
require_once( './inc/config.php' );
require_once( './vendor/class-php-ico.php' );
require_once('./vendor/aws/aws-autoloader.php');

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
            $s3client = new Aws\S3\S3Client([
                'region' => S3_REGION,
                'credentials' => [
                    'key'   => S3_ACCESS_KEY,
                    'secret'=> S3_SECRET_KEY
                ]
            ]);

            $fileName = basename($target_file);
            try {
                $result = $s3client->putObject([
                    'Bucket' => S3_BUCKET,
                    'Key' => $fileName,
                    'SourceFile' => $target_file
                ]);
            } catch (Exception $exception) {
                return "";
            }
            unlink($target_file);
            return $result['ObjectURL'];
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
    
    $i = 0;
    while(file_exists($target_file)) {
        $target_file = $target_dir . basename($file["name"]) . "_" . $i;
        $i++;
    }
    if(move_uploaded_file($file["tmp_name"], $target_file)) {
        $s3client = new Aws\S3\S3Client([
            'region' => S3_REGION,
            'credentials' => [
                'key'   => S3_ACCESS_KEY,
                'secret'=> S3_SECRET_KEY
            ]
        ]);

        $fileName = basename($target_file);
        try {
            $result = $s3client->putObject([
                'Bucket' => S3_BUCKET,
                'Key' => $fileName,
                'SourceFile' => $target_file
            ]);
        } catch (Exception $exception) {
            return "";
        }
        unlink($target_file);
        return $result['ObjectURL'];
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
        $s3client = new Aws\S3\S3Client([
            'region' => S3_REGION,
            'credentials' => [
                'key'   => S3_ACCESS_KEY,
                'secret'=> S3_SECRET_KEY
            ]
        ]);

        $fileName = basename($destination);
        try {
            $result = $s3client->putObject([
                'Bucket' => S3_BUCKET,
                'Key' => $fileName,
                'SourceFile' => $destination
            ]);
        } catch (Exception $exception) {
            echo $exception->getMessage(); die();
            return "";
        }
        unlink($destination);
        return $result['ObjectURL'];
    }
    else {
        return "";
    }
}
?>