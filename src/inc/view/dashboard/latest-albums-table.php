<?
    session_start();
    include_once('./inc/controller/page-check.php');
    include_once('./inc/controller/get-artist-list.php');
    include_once('./inc/controller/get-release-list.php');

    $RELEASE_LIMIT = 5;
    if ($isAdmin) {
        $releases = getReleaseListForAdmin($_SESSION['brand_id'], $RELEASE_LIMIT);
    }
    else {
        $releases = getReleaseListForUser($_SESSION['logged_in_user'], $RELEASE_LIMIT);
    }
?>
<div class="card">
    <div class="card-header"><h5>Latest releases</h5></div>
    <div class="card-body">
        <div class="table-responsive">
        <table class="table">
            <thead>
                <tr><th>Catalog Number</th>
                <th>Cover art</th>
                <th>Artist</th>
                <th>Title</th>
                <th>Release Date</th>
            </thead>
            <tbody>
    <? 
        if ($releases) {
            foreach ($releases as $release) { 
    ?>
                <tr>
                    <td><?=$release->catalog_no;?></td>
                    <td><img src="<?=$release->cover_art != ''? $release->cover_art : '/assets/img/placeholder.jpg';?>" width="50"></td>
                    <td><?=$release->artist_name;?></td>
                    <td><?=$release->title;?></td>
                    <td><?=$release->release_date;?></td>
                </tr>
    <?      }
        }
    ?>
            </tbody>
        </table>
        </div>
    </div>
    <div class="card-footer text-right">
        <a href="artist.php#releases">Go to releases <i class="fa fa-arrow-circle-o-right"></i></a>
    </div>
</div>
