<?php
    require_once('./inc/model/domain.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/controller/get_team_members.php');

    if (isset($_GET['artist']) && isset($_GET['user'])) {
        $result = removeMemberFromTeam($_GET['artist'], $_GET['user']);
    }
    else {
        $result = false;
    }
    
    redirectTo("/artist.php?action=RemoveMember&status=" . ($result ? "OK": "Failed") . "#team");
    
?>