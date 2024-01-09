<?
    include_once('./inc/controller/get-artist-list.php');
    include_once('./inc/controller/get-event-list.php');
    include_once('./inc/model/user.php');
    include_once('./inc/util/Redirect.php');

    include_once('./inc/controller/brand_check.php');
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
        $availableArtists = getAllArtists($_SESSION['brand_id']);
        $availableEvents = getAllEvents($_SESSION['brand_id']);
    }

    if (!isset($_SESSION['current_artist'])) {
        if(isset($availableArtists[0]->id)) {
            $_SESSION['current_artist'] = $availableArtists[0]->id;
        }
        else {
            if(!str_contains($_SERVER['REQUEST_URI'],"newartist.php")) redirectTo('/newartist.php');
        }
    }

?>