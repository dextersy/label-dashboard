<?php
    require_once('./inc/model/earning.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/controller/earning-processor.php');

    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }

    for($i = 0; $_POST['release_id_'.$i] != -1; $i++) {
        $earning = new Earning;
        $earning->release_id = $_POST['release_id_'.$i];
        $earning->type = $_POST['type_'.$i];
        $earning->description = $_POST['description_'.$i];
        $earning->amount = $_POST['amount_'.$i];
        $earning->date_recorded = $_POST['date_recorded_'.$i];
        $earning->save();

        processNewEarning($earning, ($_POST['calculateRoyalties_'.$i]=='1'));
    }

    redirectTo("/admin.php#bulk-add-earnings");
?>