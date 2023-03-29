<?
require_once('./inc/util/Redirect.php');
require_once('./inc/controller/access_check.php');

function setSelectedEvent($id) {
    $_SESSION['current_event'] = $id;
    $event = new Event;
    $event->fromID($id);
    $_SESSION['current_event_title'] = $event->title;
}

session_start();
setSelectedEvent($_GET['id']);
redirectBack();
?>