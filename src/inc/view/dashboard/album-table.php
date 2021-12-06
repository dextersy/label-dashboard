<?
    session_start();
    include_once('./inc/controller/page-check.php');
    include_once('./inc/controller/get-artist-list.php');
    include_once('./inc/controller/get-release-list.php');

    if ($isAdmin) {
        $artists = getAllArtists($_SESSION['brand_id']);
    }
    else {
        $artists = getArtistListForUser($_SESSION['logged_in_user']);
    }
?>
<div class="table-responsive">
    <table class="table">
        <thead>
            <tr><th>Catalog Number</th>
            <th>Artist</th>
            <th>Title</th>
        </thead>
        <tbody>
<? 
    if ($artists) {
        foreach ($artists as $artist) {
            $releases = getReleaseListForArtist($artist->id);
            if ($releases) {
                foreach ($releases as $release) { 
?>
            <tr>
                <td><?=$release->catalog_no;?></td>
                <td><?=$artist->name;?></td>
                <td><?=$release->title;?></td>
            </tr>
<?              }
            }
        } 
    }
?>
        </tbody>
    </table>
</div>