<?
    include_once('./inc/config.php');
    
    function getProtocol() {
        return ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] != 'off') || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
    }
    function redirectTo($path) {
        header('Location: ' . getProtocol() . $_SERVER['HTTP_HOST'] . $path);
    }

    function redirectBack() {
        header('Location: ' . getProtocol() . $_SERVER['HTTP_HOST'] . $_GET['from']);
    }
?>