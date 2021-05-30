<? 
require_once('./inc/model/artist.php');
require_once('./inc/controller/access_check.php');
?>
<div class="dropdown" style="padding:20px;">
    <button class="btn btn-default dropdown-toggle" type="button" id="artistSelection" data-toggle="dropdown" aria-haspopup="true" aria-expanded="true">
        <?php
            if ($_SESSION['current_artist'] == null ) {
                $_SESSION['current_artist'] = $availableArtists[0]->id; // Use first artist in list
            }
            $artist = new Artist;
            $artist->fromID($_SESSION['current_artist']);
        ?>
        <img src="./assets/img/logo-purple.png" width="50"> <?=$artist->name;?>
        <span class="caret"></span>
    </button>
    <ul class="dropdown-menu" aria-labelledby="artistSelection">
    <?php
        foreach($availableArtists as $artist) {
    ?>
        <li><a href="action.set-selected-artist.php?id=<?=$artist->id;?>&from=<?=$_SERVER['REQUEST_URI'];?>">
        <?=$artist->name;?>
        </a></li>
    <?
        }
    ?>
    </ul>
    <? if ( $isAdmin ) { ?>
    <a href="newartist.php"><i class="fa fa-plus"></i></a>
    <? } ?>
</div>
    