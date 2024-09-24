<?php
require_once('./inc/model/event.php');
$event = new Event;

if ($_SESSION['current_event'] != NULL) {
    $event->fromID($_SESSION['current_event']);
    $title = "Event Information";

    $systemTimezone = date_default_timezone_get();
    $eventDateTime = new DateTime($event->date_and_time, new DateTimeZone($systemTimezone));
    $eventDateTime->setTimezone(new DateTimeZone("Asia/Manila")); // Default to PH time

    $closeDateTime = new DateTime($event->close_time, new DateTimeZone($systemTimezone));
    $closeDateTime->setTimezone(new DateTimeZone('Asia/Manila'));
}
else {
    $title = "New Event";

    $eventDateTime = new DateTime('now', new DateTimeZone("Asia/Manila"));
    $closeDateTime = new DateTime('now', new DateTimeZone("Asia/Manila"));
}

$verificationPIN = (isset($event->verification_pin) && $event->verification_pin != '') ? $event->verification_pin : random_int(100000, 999999);

$formAction = "action.update-event.php?from=" . $_SERVER['REQUEST_URI'];

$status = (!isset($event->close_time) || time() <= strtotime($event->close_time))?"Open":"Closed";
$statusBadgeClass = (!isset($event->close_time) || time() <= strtotime($event->close_time))?"badge-success":"badge-danger";



?>
<script type="text/javascript">
    function copyBuyLink() {
        var copyText = document.getElementById("buy_shortlink");
        copyText.select();
        copyText.setSelectionRange(0, 999999);
        navigator.clipboard.writeText(copyText.value);
    }

    function copyVerificationPIN() {
        var copyText = document.getElementById("verification_pin");
        copyText.select();
        copyText.setSelectionRange(0, 999999);
        navigator.clipboard.writeText(copyText.value);
    }

    function copyVerificationLink() {
        var copyText = document.getElementById("verification_link");
        copyText.select();
        copyText.setSelectionRange(0, 999999);
        navigator.clipboard.writeText(copyText.value);
    }

    function generateSlug() {
        var eventName = document.getElementById('title').value;
        var slug = "Buy" + eventName.replace(/[^A-Z0-9]/ig, "");
        document.getElementById('slug').value = slug;
    }

    function resetPIN () {
        var newPIN = Math.floor(100000 + Math.random() * 900000);
        document.getElementById('verification_pin').value = newPIN;
        document.getElementById('labelResetPIN').style.display = 'block';
    }
</script>
<h3><?=$title;?></h3>
<form action="<?=$formAction;?>" method="POST" enctype="multipart/form-data">
    <input type="hidden" name="id" value="<?=$event->id;?>">
    <input type="hidden" name="brand_id" value="<?=$_SESSION['brand_id'];?>">
    <div class="row">
        <div class="col-md-6">
            <div class="card">
                <div class="card-header">General Information</div>
                <div class="card-body">
                    <div class="form-group">
                        <label for="name">Title</label>
                        <input type="text" class="form-control" id="title" name="title" placeholder="Title" value="<?=$event->title;?>" onchange="generateSlug();" required>
                    </div>

                    <div class="form-group">
                        <label for="amount">Date</label>
                        <div class="input-group">
                            <input type="datetime-local" class="form-control" id="date_and_time" name="date_and_time" placeholder="Date" value="<?=$eventDateTime->format("Y-m-d H:i:s");?>" required>
                            <div class="input-group-addon">GMT+8 (PH)</div>
                        </div>
                    </div> 

                    <div class="form-group">
                        <label for="websiteURL">Venue</label>
                        <input type="text" class="form-control" id="venue" name="venue" placeholder="Venue" value="<?=$event->venue;?>" required>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">Event poster</div>
                <div class="card-body">
                    <img src="<?=($event->poster_url!="") ? $event->poster_url : "assets/img/placeholder.jpg";?>" width="100%" style="border:#cccccc 1px solid; padding:5px;">
                    
                    <div class="form-group">
                        <label for="poster_url">Select a file</label>
                        <input type="file" class="form-control" id="poster_url" name="poster_url" accept=".jpg, .png" />
                    </div>

                </div>
            </div>

            
        </div>
        <div class="col-md-6">
            <div class="card">
                <div class="card-header">Ticketing</div>
                <div class="card-body">
                    <div class="form-group">
                        <strong>Ticket sales: </strong><span class="badge badge-pill <?=$statusBadgeClass;?>"><?=$status;?></span>
                    </div>

                    <div class="form-group">
                        <label for="websiteURL">RSVP link</label>
                        <input type="text" class="form-control" id="rsvp_link" name="rsvp_link" placeholder="RSVP Link" value="<?=$event->rsvp_link;?>">
                    </div>
                    <div class="form-group">
                        <label for="websiteURL">Ticket price</label>
                        <input type="text" class="form-control" id="ticket_price" name="ticket_price" placeholder="Ticket Price" value="<?=$event->ticket_price;?>" required>
                    </div>
                    <div class="form-group">
                        <label for="amount">Close ticket sales on</label>
                        <div class="input-group">
                            <input type="datetime-local" class="form-control" id="close_time" name="close_time" placeholder="Date" value="<?=$closeDateTime->format("Y-m-d H:i:s");?>">
                            <div class="input-group-addon">GMT+8 (PH)</div>
                        </div>
                    </div> 
                <? if (!isset($event->id)) { ?>
                    <div class="form-group">
                        <label for="slug">URL Slug</label>
                        <input type="text" class="form-control" id="slug" name="slug" placeholder="Slug" value="" required>
                    </div>
                <? } ?>
                    <div class="form-group">
                        <label for="websiteURL">Ticket purchase link</label>
                        <div class="input-group">
                            <input type="text" class="form-control" id="buy_shortlink" name="buy_shortlink" value="<?=isset($event->id)? $event->buy_shortlink : "Save to see buy link";?>" readonly>
                            <div class="input-group-addon">
                                <a href="javascript:copyBuyLink();"><i class="fa fa-copy"></i></a>
                            </div>
                        </div>
                        <small class="form-text text-muted">Share this link to ticket buyers.</small>
                    </div>

                    <div class="form-group">
                        <label for="websiteURL">Ticket verification link</label>
                        <div class="input-group">
                            <input type="text" class="form-control" id="verification_link" name="verification_link" value="<?=isset($event->id)? $event->verification_link : "Save to get link";?>" readonly>
                            <div class="input-group-addon">
                                <a href="javascript:copyVerificationLink();"><i class="fa fa-copy"></i></a>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="websiteURL">Verification PIN</label>
                        <div class="input-group">
                            <input type="text" class="form-control" id="verification_pin" name="verification_pin" value="<?=$verificationPIN;?>" readonly>
                            <div class="input-group-addon">
                                <a href="javascript:copyVerificationPIN();"><i class="fa fa-copy"></i></a>
                            </div>
                            <div class="input-group-addon">
                                <a href="javascript:resetPIN();"><i class="fa fa-refresh"></i></a>
                            </div>
                        </div>
                        <small id="labelResetPIN" class="form-text text-danger" style="display:none"><strong>Please save the event to finish resetting PIN.</strong></small>
                    </div>
                    <small class="form-text text-muted">Share verification link and PIN to gate staff.</small>
                </div>
            </div>
            
            <div class="card">
                <div class="card-header">Event description</div>
                <div class="card-body">
                    <textarea class="form-control" id="description" name="description" style="height:250px;"><?=$event->description;?></textarea>
                </div>
            </div>

       </div>
    </div>
    <div class="save-panel">
        <button type="submit" class="btn btn-block btn-primary"><i class="fa fa-save"></i> Save All Changes</button>                                                           
    </div>
</form>