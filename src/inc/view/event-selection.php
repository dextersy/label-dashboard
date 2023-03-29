<? 
require_once('./inc/model/event.php');
require_once('./inc/controller/access_check.php');
require_once('./inc/util/Redirect.php');
?>
<div class="dropdown" style="padding:20px;">
    <button class="btn btn-default dropdown-toggle" type="button" id="eventSelection" data-toggle="dropdown" aria-haspopup="true" aria-expanded="true">
        <?php
            if ($_SESSION['current_event'] == null ) {
                $_SESSION['current_event'] = $availableEvents[0]->id; // Use first artist in list
            }
            $event = new Event;
            $event->fromID($_SESSION['current_event']);
        ?>
        <img style="width:50px; height:50px; object-fit: cover; border-radius:100%;" src="<?=$event->poster_url?$event->poster_url:"assets/img/placeholder.jpg";?>">
        &nbsp;&nbsp;<?=$event->title;?>
        <span class="caret"></span>
    </button>
    <ul class="dropdown-menu" aria-labelledby="eventSelection" style="max-height:500px;overflow-y:auto;">
    <?php
        foreach($availableEvents as $event) {
    ?>
        <li><a href="action.set-selected-event.php?id=<?=$event->id;?>&from=<?=$_SERVER['REQUEST_URI'];?>">
        <?=$event->title;?>
        </a></li>
    <?
        }
    ?>
    </ul>
    <? if ( $isAdmin ) { ?>
    <a href="newevent.php"><i class="fa fa-plus"></i></a>
    <? } ?>
</div>
    