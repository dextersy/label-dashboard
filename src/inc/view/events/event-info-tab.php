<?php
require_once('./inc/model/event.php');
$event = new Event;

if ($_SESSION['current_event'] != NULL) {
    $event->fromID($_SESSION['current_event']);
    $title = "Event Information";
}
else {
    $title = "New Event";
}

$formAction = "action.update-event.php?from=" . $_SERVER['REQUEST_URI'];

?>
<h3><?=$title;?></h3>
<form action="<?=$formAction;?>" method="POST" enctype="multipart/form-data">
    <input type="hidden" name="id" value="<?=$event->id;?>">
    <input type="hidden" name="brand_id" value="<?=$_SESSION['brand_id'];?>">
    <div class="row">
        <div class="col-md-3">
            <img src="<?=($event->poster_url!="") ? $event->poster_url : "assets/img/placeholder.jpg";?>" width="100%" style="border:#cccccc 1px solid; padding:5px;">
            <div class="form-group">
                <label for="poster_url">Poster</label>
                <input type="file" class="form-control" id="poster_url" name="poster_url" accept=".jpg, .png" />
            </div>
        </div>
        <div class="col-md-5">
            <div class="form-group">
                <label for="name">Title</label>
                <input type="text" class="form-control" id="title" name="title" placeholder="Title" value="<?=$event->title;?>">
            </div>
            <div class="form-group">
                <label for="amount">Date</label>
                <input type="datetime-local" class="form-control" id="date_and_time" name="date_and_time" placeholder="Date" value="<?=$event->date_and_time;?>">
            </div> 
            <div class="form-group">
                <label for="websiteURL">Venue</label><i class="fab fa-facebook-f"></i>
                <input type="text" class="form-control" id="venue" name="venue" placeholder="Venue" value="<?=$event->venue;?>">
            </div>
       </div>
    </div>
    <div class="row">
        <div class="col-md-8">
            <div class="form-group">
                <label for="bio">Description</label>
                <textarea class="form-control" id="description" name="description" style="height:250px;"><?=$event->description;?></textarea>
            </div>                                                            
            <button type="submit" class="btn btn-default">Save Changes</button>
        </div>
    </div>
</form>