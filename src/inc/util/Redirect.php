<?
    include_once('./inc/config.php');
    function redirectTo($path) {
        header('Location: ' . URL_PROTOCOL . $_SERVER['HTTP_HOST'] . $path);
    }

    function redirectBack() {
        header('Location: ' . URL_PROTOCOL . $_SERVER['HTTP_HOST'] . $_GET['from']);
    }
?>