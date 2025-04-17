<?
    require_once('./inc/model/artist.php');
    require_once('./inc/controller/get-release-list.php');

    if (isset($_GET['edit_release']) && isset($_GET['id'])) {
        // For editing
        require_once('./inc/view/artists/release-info.php');
    }
    else {
        if ($_SESSION['current_artist']) {
            $releases = getReleaseListForArtist($_SESSION['current_artist']);
        }
        function getReleaseStatusString($status) {
            if ( $status == 'Pending' ) {
                $class = "badge-secondary";
            } else if ($status == 'Live' ) {
                $class = "badge-success";
            } else if ($status == 'Taken Down') {
                $class = "badge-light";
            }

            return "<span class=\"badge " . $class . "\">" . $status . "</span>";
        }
?>

<h3>Releases</h3>

<div class="table-responsive">
    <table class="table">
        <thead>
            <tr><th></th>
            <th>Catalog Number</th>
            <th>Title</th>
            <th>Date released</th>
            <!--<th>Links </th>-->
            <th>Status</th>
            <th></th>
        </thead>
        <tbody>
<? if ($releases) {
        foreach ($releases as $release) { ?>
            <tr>
                <td><img style="width:100px;height:100px;object-fit:cover;" src="<?=$release->cover_art!=""?$release->cover_art:"assets/img/placeholder.jpg";?>"></td>
                <td><?=$release->catalog_no;?></td>
                <td><?=$release->title;?></td>
                <td><?=$release->release_date;?></td>
                <!--
                <td>
                    <a href="<?=$release->spotify_link!=""?$release->spotify_link:"#";?>" target="_blank"><i style="font-size: 1.5em;" class="fa fa-spotify"></i></a>
                    <a href="<?=$release->apple_link!=""?$release->apple_link:"#";;?>" target="_blank"><i style="font-size: 1.5em;"  class="fa fa-apple"></i></a>
                    <a href="<?=$release->youtube_link!=""?$release->youtube_link:"#";?>" target="_blank"><i style="font-size: 1.5em;"  class="fa fa-youtube"></i></a>
                    <a href="<?=$release->bandcamp_link!=""?$release->bandcamp_link:"#";?>" target="_blank"><i style="font-size: 1.5em;"  class="fa fa-bandcamp"></i></a>
                </td>
                -->
                <td><?=getReleaseStatusString($release->status);?></a></td>
                <td>
                <? if ($isAdmin) { ?>
                    <a href="artist.php?edit_release&id=<?=$release->id;?>#releases"><i class="fa fa-pencil"></i></a>
                <? } ?>
                </td>
            </tr>
<?      } 
        } else { ?>
    No releases yet.
<?      } ?>
        </tbody>
    </table>
</div>
<?
    }
?>