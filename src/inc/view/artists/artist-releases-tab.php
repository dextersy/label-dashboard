<?
    require_once('./inc/model/artist.php');
    require_once('./inc/controller/get-release-list.php');

    if ($_SESSION['current_artist']) {
        $releases = getReleaseListForArtist($_SESSION['current_artist']);
    }
    function getReleaseStatusString($status) {
        if ( $status == 'Pending' ) {
            $color = "gray";
        } else if ($status == 'Live' ) {
            $color = "green";
        } else if ($status == 'Taken Down') {
            $color = "red";
        }

        return "<span style=\"color:" . $color . ";\"><i class=\"fa fa-circle\" aria-hidden=\"true\"></i> " . $status;
    }
?>

<h3>Releases</h3>
<div class="table-responsive">
    <table class="table">
        <thead>
            <tr><th>Catalog Number</th>
            <th>Title</th>
            <th>Date released</th>
            <th>Spotify <i class="fa fa-spotify"></i></th>
            <th>Apple Music <i class="fa fa-apple"></th>
            <th>Bandcamp <i class="fa fa-bandcamp"></th>
            <th>Status <i class="fa fa-bandcamp"></th>
        </thead>
        <tbody>
<? if ($releases) {
        foreach ($releases as $release) { ?>
            <tr>
                <td><?=$release->catalog_no;?></td>
                <td><?=$release->title;?></td>
                <td><?=$release->release_date;?></td>
                <td><a href="<?=$release->spotify_link;?>" target="_blank"><?=$release->spotify_link;?></a></td>
                <td><a href="<?=$release->apple_link;?>" target="_blank"><?=$release->apple_link;?></a></td>
                <td><a href="<?=$release->youtube_link;?>" target="_blank"><?=$release->youtube_link;?></a></td>
                <td><?=getReleaseStatusString($release->status);?></a></td>
            </tr>
<?      } 
    } else { ?>
    No releases yet.
<?  } ?>
        </tbody>
    </table>
</div>