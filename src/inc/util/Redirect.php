<?
    function redirectTo($path) {
        header('Location: http://' .$_SERVER['HTTP_HOST'] . "/meltrecords" . $path);
    }

    function redirectBack() {
        header('Location: http://' .$_SERVER['HTTP_HOST'] . $_GET['from']);
    }
?>