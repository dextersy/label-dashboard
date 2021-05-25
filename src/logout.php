<?
    include_once('./inc/util/Redirect.php');
    session_start();
    session_destroy();
    redirectTo('/index.php');
?>