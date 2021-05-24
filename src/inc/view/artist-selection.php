<? 
require_once('./inc/model/artist.php');
require_once('./inc/controller/get-artist-list.php');
?>
<div class="dropdown">
    <button class="btn btn-default dropdown-toggle" type="button" id="artistSelection" data-toggle="dropdown" aria-haspopup="true" aria-expanded="true">
        Select an artist
        <span class="caret"></span>
    </button>
    <ul class="dropdown-menu" aria-labelledby="artistSelection">
    <?php
        $artists = getArtistListForUser($_SESSION['username']);
        foreach($artists as $artist) {
    ?>
        <li><a href="./inc/controller/set-selected-artist.php?id=<?=$artist->id;?>&from=<?=$_SERVER['REQUEST_URI'];?>">
        <?=$artist->name;?>
        </a></li>
    <?
        }
    ?>
    </ul>
</div>
    