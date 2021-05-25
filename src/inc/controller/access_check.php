<?
    include_once('./inc/controller/get-artist-list.php');
    include_once('./inc/model/user.php');
    include_once('./inc/util/Redirect.php');

    session_start();

    if ($_SESSION['logged_in_user'] == null ) {
        redirectTo('/index.php');
    }

    $user = new User;
    $user->fromID($_SESSION['logged_in_user']);

    // Privilege flags and data
    $isAdmin = $user->is_admin;
    if (!$isAdmin) {
        $availableArtists = getArtistListForUser($_SESSION['logged_in_user']);
    } else {
        $availableArtists = getAllArtists();
    }
?>