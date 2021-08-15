<?
require_once('./inc/util/Redirect.php');
require_once('./inc/controller/access_check.php');

function setSelectedArtist($id) {
    $_SESSION['current_artist'] = $id;
    $artist = new Artist;
    $artist->fromID($id);
    $_SESSION['current_artist_name'] = $artist->name;
}

session_start();
setSelectedArtist($_GET['id']);
redirectBack();
?>