<?
function setSelectedArtist($id) {
    $_SESSION['current_artist'] = $id;

}

session_start();
setSelectedArtist($_GET['id']);
header('Location: http://' .$_SERVER['HTTP_HOST'] . $_GET['from']);
?>