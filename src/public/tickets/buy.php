<?
    chdir("../..");
    include_once("./inc/controller/brand_check.php");
    include_once("./inc/controller/get_referrers.php");
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

    // Check validity of referral code
    if(isset($_GET['ref'])) {
      $referrer = getReferrerFromCode($_GET['ref']);
      if($referrer == null) {
        unset($_GET['ref']);
      }
    }
?>
<header>
  <title>Buy tickets to <?=$event->title;?></title>
  <meta content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0' name='viewport' />
    <meta name="viewport" content="width=device-width" />
  <meta property="og:image" content="<?="https://" . $_SERVER['SERVER_NAME'] . "/" . $event->poster_url;?>"/>

    <script type="text/javascript">
      function calculateTotal() {
        var pricePerTicket = <?=$event->ticket_price;?>;
        var numberOfTickets = document.getElementById('number_of_entries').value;
        var divPaymentCalculation = document.getElementById('div_paymentCalculation');
        var spanTotalAmount = document.getElementById('span_totalAmount');

        if(numberOfTickets != '') {
          var totalPrice = pricePerTicket * numberOfTickets;
          spanTotalAmount.innerHTML = (Math.round(totalPrice * 100) / 100).toLocaleString('en-US', {minimumFractionDigits:2});
          divPaymentCalculation.style.display = 'block';
        }
        else {
          spanTotalAmount.innerHTML = '0.00';
          divPaymentCalculation.style.display = 'none';
        }
      }

      function validateFields() {
        var error = "";
        var hasError = false;

        var nameField = document.getElementById('name');
        var emailField = document.getElementById('email');
        var contactNumField = document.getElementById('contact_number');
        var numberOfTicketsField = document.getElementById('number_of_entries');

        var privacyConsentCheckbox = document.getElementById('checkbox_privacyConsent');

        var submitButton = document.getElementById('btnSubmit');
        var errorDisplay = document.getElementById('divErrorMessage');

        if(nameField.value.length < 1) {
          hasError = true;
          error = error + "<li> Name cannot be empty.";
        }
        if(emailField.value.length < 1) {
          hasError = true;
          error = error + "<li> Email address cannot be empty.";
        }
        if(contactNumField.value.length < 1) {
          hasError = true;
          error = error + "<li> Contact number cannot be empty.";
        }
        if(numberOfTicketsField.value.length < 1) {
          hasError = true;
          error = error + "<li> Number of tickets cannot be empty.";
        }
        if(!privacyConsentCheckbox.checked) {
          hasError = true;
          error = error + "<li> You need to accept the privacy agreement to proceed.";
        }

        if (hasError) {
          submitButton.disabled = true;
          submitButton.title = 'Please see errors above.'
          errorDisplay.innerHTML = error;
          errorDisplay.style.display = 'block';
        }
        else {
          submitButton.disabled = false;
          submitButton.title = '';
          errorDisplay.innerHTML = '';
          errorDisplay.style.display = 'none';
        }
      }

      function showOverlay() {
        document.getElementById('loadingOverlay').style.display = 'flex';
      }
    </script>

</header>

<body>

<link href="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" rel="stylesheet" id="bootstrap-css">
<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/latest/css/font-awesome.min.css" />
<link href="style.css?version=1.7" rel="stylesheet">
<script src="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<!------ Include the above in your HEAD tag ---------->

<div id="loadingOverlay" class="loading-overlay" style="display:none;">
  <div class="loading"></div>
</div>

<div class="wrapper fadeInDown">

<div class="header-section">
  <div class="container">
  <div class="row align-items-center h-100">
<?php
  if (isset($event->poster_url) && $event->poster_url != '') {
?>
      <div class="col-md-3 event-poster-container">
        <img src="../../<?=$event->poster_url;?>" class="event-poster">
      </div>
      <div class="col-md-9" style="padding:30px;">
<? } 
  else { 
?>
      <div class="col-md-12">
<?
  }
  if (!isset($event->close_time) || time() <= strtotime($event->close_time)) {
?>
   <h5>Get tickets to</h5>
   <h1><strong><?=$event->title;?></strong></h1>
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
</div>
<?php
  if (!isset($event->close_time) || time() <= strtotime($event->close_time)) {
?>


<div class="body-section">
<form action="action.buy.php" method="POST">
<div class="container">
  <div class="row h-50">
    <div class="col-md-7">
      &nbsp;
      <h6><strong>Step 1.</strong> Please provide your details.</h6>

          <input type="hidden" id="event_id" name="event_id" value="<?=$event->id;?>">
          
          <div class="material-textfield">
            <input type="text" id="name" class="fadeIn first material" name="name" placeholder="" onchange="validateFields();" required>
            <label class="fadeIn first floating">Full name</label>
          </div>

          <div class="material-textfield">
          <input type="email" id="email" class="fadeIn second material" name="email_address" placeholder="" onchange="validateFields();" required>
            <label class="fadeIn second floating">Email address</label>
          </div>

          <div class="material-textfield">
            <input type="text" id="contact_number" class="fadeIn third material" name="contact_number" placeholder="" onchange="validateFields();" required>        
            <label class="fadeIn third floating">Contact number</label>
          </div>

          <div class="material-textfield">
            <input type="number" min="1" step="1" id="number_of_entries" class="fadeIn fourth material" name="number_of_entries" placeholder="" onchange="validateFields();calculateTotal();" onkeyup="validateFields();calculateTotal();" required>
            <label class="fadeIn fourth floating">Number of tickets</label>
          </div>

          <div class="material-textfield">
          <? if (isset($_GET['ref'])) { ?>
            <input type="hidden" name="referral_code" value="<?=$_GET['ref'];?>">
            <strong>Referral code: </strong><span class="badge badge-info"><?=$_GET['ref'];?></span>
          <? } else { ?>
            <input type="text" id="referral_code" class="fadeIn fifth material" name="referral_code" placeholder="">
            <label class="fadeIn fifth floating">Referral code (optional)</label>
          <? } ?>  
          </div>  
    </div>

    <div class="col-md-5">
      &nbsp;
      <h6><i class="fa fa-info-circle"></i> <strong>Important reminders before submitting</strong></h6>
      <div class="alert alert-info field-description text-dark">
        <ul>
          <li>Please use a name that is shown in any valid ID, as you may be requested to present identification at the gate.</li>
          <li>Please make sure your email address is correct to make sure that you receive your ticket without any problem.</li>
          <li>Tickets are non-refundable once paid.</li>
        </ul>
      </div>
      
      <div class="form-check">
        <input class="form-check-input" type="checkbox" value="" id="checkbox_privacyConsent" onclick="validateFields();">
        <label class="form-check-label field-description" for="checkbox_privacyConsent">
        I agree to share my data to <?=$brand->brand_name;?> and its affiliates for the sole purpose of processing my purchase of tickets.
        </label>
      </div>
      <div id="divPay">
      <div id="div_paymentCalculation" style="display:none;">
          <hr>
            <h5>Total amount is <b>P<span id="span_totalAmount">0</span></b>.</h5>
          <hr>
      </div>
      <div class="alert alert-warning" id="divErrorMessage" style="font-size:14px;display:none;"></div>
      
      <button id="btnSubmit" type="submit" class="btn btn-primary btn-block" disabled onclick="showOverlay();"><i class="fa fa-credit-card"></i> Proceed to Payment</button>
      <div class="fadeIn sixth" style="font-size:12px;">Clicking <b>Proceed to Payment</b> will bring you to our Paymongo checkout page. Payee information will be <strong>Melt Records</strong>.</div>
      </div>
    </div>
  </div>
</div>
</form>
</div>
<?}?>

  <div class="text-center">
    <p>&nbsp;</p>
    <p>
      <span style="font-size:12px; font-weight:bold;">Powered by Melt Records Dashboard.</span><br>
      <span style="font-size:12px; font-style:italic;">Having trouble? Contact us via email <a href="mailto:support@melt-records.com?subject=Issue with ticketing for <?=$event->title;?>">here</a> or <a href="https://m.me/meltrecordsph" target="_blank">chat with us</a> on Facebook.</span>
    </p>
  </div>

</div>
</body>