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
<script type="text/javascript">
    function copyBuyLink() {
        var copyText = document.getElementById("buy_shortlink");
        copyText.select();
        copyText.setSelectionRange(0, 999999);
        navigator.clipboard.writeText(copyText.value);
    }

    function generateSlug() {
        var eventName = document.getElementById('title').value;
        var slug = "Buy" + eventName.replace(/[^A-Z0-9]/ig, "");
        document.getElementById('slug').value = slug;
    }
</script>
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
                <input type="text" class="form-control" id="title" name="title" placeholder="Title" value="<?=$event->title;?>" onchange="generateSlug();">
            </div>
            <div class="form-group">
                <label for="amount">Date</label>
                <input type="datetime-local" class="form-control" id="date_and_time" name="date_and_time" placeholder="Date" value="<?=$event->date_and_time;?>">
            </div> 
            <div class="form-group">
                <label for="websiteURL">Venue</label>
                <input type="text" class="form-control" id="venue" name="venue" placeholder="Venue" value="<?=$event->venue;?>">
            </div>
            <div class="form-group">
                <label for="websiteURL">RSVP link</label>
                <input type="text" class="form-control" id="rsvp_link" name="rsvp_link" placeholder="RSVP Link" value="<?=$event->rsvp_link;?>">
            </div>
            <div class="form-group">
                <label for="websiteURL">Ticket price</label>
                <input type="text" class="form-control" id="ticket_price" name="ticket_price" placeholder="Ticket Price" value="<?=$event->ticket_price;?>">
            </div>
            <div class="form-group">
                <label for="amount">Close ticket sales on</label>
                <input type="datetime-local" class="form-control" id="close_time" name="close_time" placeholder="Date" value="<?=$event->close_time;?>">
            </div> 
        <? if (!isset($event->id)) { ?>
            <div class="form-group">
                <label for="slug">URL Slug</label>
                <input type="text" class="form-control" id="slug" name="slug" placeholder="Slug" value="">
            </div>
        <? } ?>
            <div class="form-group">
                <label for="websiteURL">Ticket purchase link</label>
                <em>Share this link to ticket buyers.</em>
                <div class="row">
                    <div class="col-md-11">
                        <input type="text" class="form-control" id="buy_shortlink" name="buy_shortlink" value="<?=isset($event->id)? $event->buy_shortlink : "Save to see buy link";?>" readonly>
                    </div>
                    <div class="col-md-1">
                        <a href="javascript:copyBuyLink();"><i class="fa fa-copy"></i></a>
                    </div>
                </div>
            </div>
            <div class="form-group">
                <strong>Status: </strong><?=(!isset($event->close_time) || time() <= strtotime($event->close_time))?"Open":"Closed";?>
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