<?php
    require_once('./inc/model/event.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/controller/brand_check.php');
    require_once('./inc/util/Mailer.php');
    require_once('./inc/util/FileUploader.php');

    if(isset($_POST['id'])) {
        $eventOld = new Event;
        $eventOld->fromID($_POST['id']);
    }
    $event = new Event;
    $event->fromFormPOST($_POST);
    if(isset($_FILES["poster_url"]["tmp_name"]) && $_FILES["poster_url"]["tmp_name"] != "") {
        $event->poster_url = uploadImage($_FILES['poster_url']);
    }
    $event->save();

    $_SESSION['current_event'] = $event->id;

    redirectTo("/events.php?action=profile&status=" . $result);
?>