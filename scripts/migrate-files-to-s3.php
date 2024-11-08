<?php
    require_once ('./inc/config.php');  
    require_once ('./inc/MySQLConnection.php');  
    require_once ('./inc/aws/aws-autoloader.php');
    
    MySQLConnection::connect();

    // Migrate gallery images
    echo "*********\nStarting migration of gallery images...\n";
    $sql = "SELECT `id`, `path` FROM `artist_image` WHERE `path` LIKE 'uploads/%'";
    $result = MySQLConnection::query($sql);
    $count = 0; $failed = 0;
    while($row = mysqli_fetch_assoc($result)) {
        $error = false;
        $target_file = __DIR__ . "/../src/" . $row['path'];
        $newPath = uploadFileToS3AndDeleteLocal($target_file);

        if($newPath != null) {
            $sql = "UPDATE `artist_image` SET `path` = '" . MySQLConnection::escapeString($newPath) . "' WHERE `id` = '" . $row['id'] . "'";
            MySQLConnection::query($sql);
            echo $target_file . " -- uploaded to " . $newPath . "\n";
            $count++;
        }
        else {
            echo $target_file . " -- UPLOAD FAILED!!!\n";
            $failed++;
        }
    }
    echo "Completed migration of gallery images. " . $count . " files moved successfully. " . $failed . " transfers failed.\n";

    // Migrate profile photos
    echo "*********\nStarting migration of profile photos...\n";
    $sql = "SELECT `id`, `profile_photo` FROM `artist` WHERE `profile_photo` LIKE 'uploads/%'";
    $result = MySQLConnection::query($sql);
    $count = 0; $failed = 0;
    while($row = mysqli_fetch_assoc($result)) {
        $error = false;
        $target_file = __DIR__ . "/../src/" . $row['profile_photo'];
        $newPath = uploadFileToS3AndDeleteLocal($target_file);

        if($newPath != null) {
            $sql = "UPDATE `artist` SET `profile_photo` = '" . MySQLConnection::escapeString($newPath) . "' WHERE `id` = '" . $row['id'] . "'";
            MySQLConnection::query($sql);
            echo $target_file . " -- uploaded to " . $newPath . "\n";
            $count++;
        }
        else {
            echo $target_file . " -- UPLOAD FAILED!!!\n";
            $failed++;
        }
    }
    echo "Completed migration of profile photos. " . $count . " files moved successfully. " . $failed . " transfers failed.\n";

    // Migrate documents
    echo "*********\nStarting migration of documents...\n";
    $sql = "SELECT `id`, `path` FROM `artist_documents` WHERE `path` LIKE 'uploads/%'";
    $result = MySQLConnection::query($sql);
    $count = 0; $failed = 0;
    while($row = mysqli_fetch_assoc($result)) {
        $error = false;
        $target_file = __DIR__ . "/../src/" . $row['path'];
        $newPath = uploadFileToS3AndDeleteLocal($target_file);

        if($newPath != null) {
            $sql = "UPDATE `artist_documents` SET `path` = '" . MySQLConnection::escapeString($newPath) . "' WHERE `id` = '" . $row['id'] . "'";
            MySQLConnection::query($sql);
            echo $target_file . " -- uploaded to " . $newPath . "\n";
            $count++;
        }
        else {
            echo $target_file . " -- UPLOAD FAILED!!!\n";
            $failed++;
        }
    }
    echo "Completed migration of documents. " . $count . " files moved successfully. " . $failed . " transfers failed.\n";

    // Migrate release cover art
    echo "*********\nStarting migration of release cover art...\n";
    $sql = "SELECT `id`, `cover_art` FROM `release` WHERE `cover_art` LIKE 'uploads/%'";
    $result = MySQLConnection::query($sql);
    $count = 0; $failed = 0;
    while($row = mysqli_fetch_assoc($result)) {
        $error = false;
        $target_file = __DIR__ . "/../src/" . $row['cover_art'];
        $newPath = uploadFileToS3AndDeleteLocal($target_file);

        if($newPath != null) {
            $sql = "UPDATE `release` SET `cover_art` = '" . MySQLConnection::escapeString($newPath) . "' WHERE `id` = '" . $row['id'] . "'";
            MySQLConnection::query($sql);
            echo $target_file . " -- uploaded to " . $newPath . "\n";
            $count++;
        }
        else {
            echo $target_file . " -- UPLOAD FAILED!!!\n";
            $failed++;
        }
    }
    echo "Completed migration of release cover art. " . $count . " files moved successfully. " . $failed . " transfers failed.\n";

    // Migrate brand logos and favicons
    echo "*********\nStarting migration of brand logos and favicons...\n";
    $sql = "SELECT `id`, `logo_url`, `favicon_url` FROM `brand` WHERE `logo_url` LIKE 'uploads/%' OR `favicon_url` LIKE 'uploads/%'";
    $result = MySQLConnection::query($sql);
    $count = 0; $failed = 0;
    while($row = mysqli_fetch_assoc($result)) {
        $error = false;
        if(str_starts_with($row['logo_url'], 'uploads/')) {
            $target_file = __DIR__ . "/../src/" . $row['logo_url'];
            $newLogoPath = uploadFileToS3AndDeleteLocal($target_file);
        }
        else {
            $newLogoPath = $row['logo_url'];
        }

        if(str_starts_with($row['favicon_url'], 'uploads/')) {
            $target_file = __DIR__ . "/../src/" . $row['favicon_url'];
            $newFaviconPath = uploadFileToS3AndDeleteLocal($target_file);
        }
        else {
            $newFaviconPath = $row['favicon_url'];
        }

        if($newPath != null) {
            $sql = "UPDATE `brand` SET `logo_url` = '" . MySQLConnection::escapeString($newLogoPath) . "', `favicon_url` = '" . MySQLConnection::escapeString($newFaviconPath) . "'  WHERE `id` = '" . $row['id'] . "'";
            MySQLConnection::query($sql);
            echo $target_file . " -- uploaded to " . $newPath . "\n";
            $count++;
        }
        else {
            echo $target_file . " -- UPLOAD FAILED!!!\n";
            $failed++;
        }
    }
    echo "Completed migration of brand logos and favicons. " . $count . " files moved successfully. " . $failed . " transfers failed.\n";

    echo "Migration completed!";

    function uploadFileToS3AndDeleteLocal($target_file) {
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
            return null;
        }
        unlink($target_file);
        return $result['ObjectURL'];
    }
?>