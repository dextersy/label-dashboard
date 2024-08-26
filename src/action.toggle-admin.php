<?php
    require_once('./inc/model/user.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/controller/brand_check.php');
    require_once('./inc/util/Mailer.php');
    require_once('./inc/controller/get_team_members.php');
    require_once('./inc/util/FileUploader.php');

    if(isset($_GET['id']) && strlen($_GET['id']) > 0) {
        $user = new User;
        $user->fromID($_GET['id']);
        $user->is_admin = !($user->is_admin);
        $user->save();
    }

    redirectTo("/admin.php?action=make-admin&status=" . $result);
?>