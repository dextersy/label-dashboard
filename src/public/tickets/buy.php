<?
    chdir("../..");
    include_once("./inc/controller/brand_check.php");
    include_once("./inc/model/brand.php");
    include_once("./inc/model/event.php");

    $event = new Event;
    $event->fromID($_GET['id']);

    if($event->brand_id != $_SESSION['brand_id'] || $event->title == '') {
      header('HTTP/1.0 404 not found');
      die();
    }

    $brand = new Brand;
    $brand->fromID($event->brand_id);
?>
<header>
  <title>Buy tickets to <?=$event->title;?></title>
  <meta content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0' name='viewport' />
    <meta name="viewport" content="width=device-width" />
  <meta property="og:image" content="<?="https://" . $_SERVER['SERVER_NAME'] . "/" . $event->poster_url;?>"/>
</header>

<body>

<link href="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" rel="stylesheet" id="bootstrap-css">
<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/latest/css/font-awesome.min.css" />
<link href="style.css?version=1.6" rel="stylesheet">
<script src="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<!------ Include the above in your HEAD tag ---------->

<div class="wrapper fadeInDown">
    <div id="formHeader">
      <div class="row align-items-center h-100">
<?php
  if (isset($event->poster_url) && $event->poster_url != '') {
?>
      <div class="col-md-4">
        <img src="../../<?=$event->poster_url;?>" class="event-poster">
      </div>
      <div class="col-md-8">
<? } 
  else { 
?>
      <div class="col-md-12">
<?
  }
  if (!isset($event->close_time) || time() <= strtotime($event->close_time)) {
?>
  <h1 style="color:black; font-size:2rem;">Buy tickets to <strong><?=$event->title;?></strong></h1>
  <h5>Step 1. Please provide your details.</h4>
<?php
  }
  else {
?>
  <h1 style="color:black;">Sorry, ticket sales for this event are closed.</h1>
  <h4>Walk-in may still be available at the show.<br>Check our social media for more details.</h4>
<?php 
  }
?>
      </div>
  </div>
</div>
<?php
  if (!isset($event->close_time) || time() <= strtotime($event->close_time)) {
?>

<div class="alert alert-info field-description belowTitle text-dark"><i class="fa fa-info-circle"></i> <b>Important reminders</b><br>
  <ul>
    <li>Please use a name that is shown in any valid ID, as you may be requested to present identification at the gate.</li>
    <li>Please make sure your email address is correct to make sure that you receive your ticket without any problem.</li>
    <li>Tickets are non-refundable once paid.</li>
  </ul>
</div>

  <div id="formContent" style="background-color:<?=$brand->brand_color;?>;">
    <!-- Tabs Titles -->

    <!-- Alert -->
    
    <!-- Sales purchase Form -->
    <form action="action.buy.php" method="POST">
      <input type="hidden" id="event_id" name="event_id" value="<?=$event->id;?>">
      <input type="text" id="name" class="fadeIn second" name="name" placeholder="Your Name" required><br>
      <input type="email" id="email" class="fadeIn third" name="email_address" placeholder="Your Email Address" required>
      <input type="text" id="contact_number" class="fadeIn fourth" name="contact_number" placeholder="Contact Number" required>
      <input type="number" min="1" step="1" id="number_of_entries" class="fadeIn fifth" name="number_of_entries" placeholder="How many tickets?" required>
      <input type="text" id="referral_code" class="fadeIn fifth" name="referral_code" placeholder="Referral code (optional)" <?=isset($_GET['ref'])?'value="' . $_GET['ref'] . '" readonly':'';?>><br><br>
      <button type="submit" class="fadeIn sixth"><i class="fa fa-credit-card"></i> Proceed to Payment</button>
      <div class="fadeIn sixth field-description text-white" style="font-size:12px;">Clicking "Proceed" will bring you to our checkout page. Payee information will be <strong>Melt Records</strong>.</div>
      <div class="fadeIn sixth field-description text-white">We respect your privacy and will use your information only for the purpose of validating your purchase.<br>By submitting this form, you agree to share your data with us.</div>
      
    </form>

    <!-- Remind Passowrd -->
    <div id="formFooter">
    <p style="font-size:12px; font-weight:bold;">Powered by Melt Records Dashboard</p>
    </div>
  </div>
<?}?>
</div>
</body>