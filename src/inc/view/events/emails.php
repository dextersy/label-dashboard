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
    $event = new Event;

    $eventDateTime = new DateTime('now', new DateTimeZone("Asia/Manila"));
    $closeDateTime = new DateTime('now', new DateTimeZone("Asia/Manila"));
}

$verificationPIN = (isset($event->verification_pin) && $event->verification_pin != '') ? $event->verification_pin : random_int(100000, 999999);

$formAction = "action.update-event.php?from=" . $_SERVER['REQUEST_URI'];

$status = (!isset($event->close_time) || time() <= strtotime($event->close_time))?"Open":"Closed";
$statusBadgeClass = (!isset($event->close_time) || time() <= strtotime($event->close_time))?"badge-success":"badge-danger";



?>
<link href="/styles.css" rel="stylesheet" />
<link href="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css" rel="stylesheet" />
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.js"></script>
<link
  rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css"
/>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" />
<h3>Send email</h3>
<form action="<?=$formAction;?>" method="POST" enctype="multipart/form-data">
    <input type="hidden" name="id" value="<?=$event->id;?>">
    <input type="hidden" name="brand_id" value="<?=$_SESSION['brand_id'];?>">
    <div id="toolbar-container">
  <span class="ql-formats">
    <select class="ql-font"></select>
    <select class="ql-size"></select>
  </span>
  <span class="ql-formats">
    <button class="ql-bold"></button>
    <button class="ql-italic"></button>
    <button class="ql-underline"></button>
    <button class="ql-strike"></button>
  </span>
  <span class="ql-formats">
    <select class="ql-color"></select>
    <select class="ql-background"></select>
  </span>
  <span class="ql-formats">
    <button class="ql-script" value="sub"></button>
    <button class="ql-script" value="super"></button>
  </span>
  <span class="ql-formats">
    <button class="ql-header" value="1"></button>
    <button class="ql-header" value="2"></button>
    <button class="ql-blockquote"></button>
    <button class="ql-code-block"></button>
  </span>
  <span class="ql-formats">
    <button class="ql-list" value="ordered"></button>
    <button class="ql-list" value="bullet"></button>
    <button class="ql-indent" value="-1"></button>
    <button class="ql-indent" value="+1"></button>
  </span>
  <span class="ql-formats">
    <button class="ql-direction" value="rtl"></button>
    <select class="ql-align"></select>
  </span>
  <span class="ql-formats">
    <button class="ql-link"></button>
    <button class="ql-image"></button>
    <button class="ql-video"></button>
    <button class="ql-formula"></button>
  </span>
  <span class="ql-formats">
    <button class="ql-clean"></button>
  </span>
</div>
    <div id="editor" style="height:500px">
        <p>Hello World!</p>
        <p>Some initial <strong>bold</strong> text</p>
        <p><br /></p>
    </div>
        
    <div class="save-panel">
        <div class="col-md-6"><button type="submit" class="btn btn-block btn-primary"><i class="fa fa-hdd-o"></i> Save All Changes</button></div>
        <div class="col-md-6"><button type="button" class="btn btn-block btn-secondary"><i class="fa fa-search-plus"></i> Preview</button></div>                                                                   
    </div>
</form>
<!-- Initialize Quill editor -->
<script>
    const options = {
        modules: {
            syntax: true,
            toolbar: '#toolbar-container',
        },
        placeholder: 'Compose an epic...',
        theme: 'snow'
    };
  const quill = new Quill('#editor', options);
</script>