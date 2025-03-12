<?
    chdir("../..");
    include_once("./inc/controller/brand_check.php");
    include_once("./inc/controller/get_referrers.php");
    include_once("./inc/controller/events-controller.php");
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

    // Check tickets remaining
    if($event->max_tickets > 0) {
      $max_tickets = $event->max_tickets;
      $total_tickets_sold = getTotalTicketsSold($event->id);
      $remaining_tickets = $max_tickets - $total_tickets_sold;
    }
?>
<header>
  <title>Buy tickets to <?=$event->title;?></title>
  <meta content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0' name='viewport' />
    <meta name="viewport" content="width=device-width" />
  <meta property="og:image" content="<?=$event->poster_url;?>"/>

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
        var hasError = false;
        var privacyConsentCheckbox = document.getElementById('checkbox_privacyConsent');

        // Validate required fields
        hasError = validateFieldHasInput('name') || hasError;
        hasError = validateFieldHasInput('contact_number') || hasError;
        hasError = validateFieldHasInput('number_of_entries') || hasError;

        // Validate email format
        var emailField = document.getElementById('email');
        if(!isValidEmail(emailField.value)) {
          hasError = true;
          emailField.classList.add('error');
          showErrorMessage('email');
        }
        else {
          emailField.classList.remove('error');
          hideErrorMessage('email');
        }

        // Validate privacy consent
        if(!privacyConsentCheckbox.checked) {
          hasError = true;
          privacyConsentCheckbox.classList.add('error');
          showErrorMessage('checkbox_privacyConsent');
        }
        else {
          privacyConsentCheckbox.classList.remove('error');
          hideErrorMessage('checkbox_privacyConsent');
        }
        return hasError;
      }

      function validatePurchaseForm() {
        var hasError = validateFields();
        if(!hasError) { 
          showOverlay();
          return true; // proceed submit
        }
        else {
          // Focus first item with error
          var errorFields = document.getElementsByClassName('error');
          errorFields[0].focus();
          return false; // stop submit
        }
      }

      function showOverlay() {
        document.getElementById('loadingOverlay').style.display = 'flex';
      }

      function isValidEmail(email) 
      {
        var mailformat = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        if(email.match(mailformat)) return true;
        else return false;
      }

      function validateFieldHasInput(fieldName) {
        var field = document.getElementById(fieldName);
        if(field.value.length < 1) {
          hasError = true;
          field.classList.add('error');
          showErrorMessage(fieldName);
        }
        else {
          hasError = false;
          field.classList.remove('error');
          hideErrorMessage(fieldName);
        }
        return hasError;
      }
      function showErrorMessage(fieldName) {
        var errorMessage = document.getElementById('error_' + fieldName);
        var reminderMessage = document.getElementById('reminder_' + fieldName);
        errorMessage.style.display = 'block';
        if(reminderMessage) {
          reminderMessage.style.display = 'none';
        }
      }
      function hideErrorMessage(fieldName) {
        var errorMessage = document.getElementById('error_' + fieldName);
        var reminderMessage = document.getElementById('reminder_' + fieldName);
        errorMessage.style.display = 'none';
        if(reminderMessage) {
          reminderMessage.style.display = 'block';
        }
      }

    </script>
  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','GTM-KQHJ23P');</script>
  <!-- End Google Tag Manager -->
</header>
<body>
<!--Start of Tawk.to Script-->
<script type="text/javascript">
  var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
  (function(){
    var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
    s1.async=true;
    s1.src='https://embed.tawk.to/66e83bc3ea492f34bc148d81/1i7tiitgd';
    s1.charset='UTF-8';
    s1.setAttribute('crossorigin','*');
    s0.parentNode.insertBefore(s1,s0);
  })();
</script>
<!--End of Tawk.to Script-->
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-KQHJ23P"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
<link href="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" rel="stylesheet" id="bootstrap-css">
<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/latest/css/font-awesome.min.css" />
<link href="style.css?version=1.8" rel="stylesheet">
<script src="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<!------ Include the above in your HEAD tag ---------->

<div id="loadingOverlay" class="loading-overlay" style="display:none;">
  <div class="loading"></div>
</div>

<div class="wrapper fadeInDown h-100">

<div class="header-section">
  <div class="container">
  <div class="row align-items-center h-100">
<?php
  if (isset($event->poster_url) && $event->poster_url != '') {
?>
      <div class="col-md-4 event-poster-container">
        <img src="<?=$event->poster_url;?>" class="event-poster">
      </div>
      <div class="col-md-8" style="padding:30px;">
<? } 
  else { 
?>
      <div class="col-md-12 text-center">
<?
  }
  if ((!isset($event->close_time) || time() <= strtotime($event->close_time)) && (!isset($remaining_tickets) || $remaining_tickets > 0)) {
?>
   <h5>Get tickets to</h5>
   <h1><strong><?=$event->title;?></strong></h1>
   <?
      $eventDate = date_create($event->date_and_time);
   ?>
   <h5><strong><?=date_format($eventDate, "F d, Y");?></strong> at <strong><?=$event->venue;?></strong></h5>
<?php
  }
  else {
?>
  <h1 style="font-size:2.5rem;font-weight:bold;">Sorry, we're closed...</h1>
  <h1 style="font-size:1.5rem;font-style:italic;">— but the door's still open!</h1>
  <h3>&nbsp;</h3>
  <h5>Online ticket sales for <b><?=$event->title;?></b> has already ended. 🥲</h5>
  <h5>But don't worry — tickets or walk-in may still be available at the show!</h5>
  <p>
    Please check <a href="<?=$event->rsvp_link;?>"><strong><?=$brand->brand_name;?></strong> social media or the event page</a> for more information.
  </p>
<?php 
  }
?>
      </div>
  </div>
  </div>
</div>
<?php
  if ((!isset($event->close_time) || time() <= strtotime($event->close_time)) && (!isset($remaining_tickets) || $remaining_tickets > 0)) {
?>


<div class="body-section">
<form id="purchaseForm" action="action.buy.php" method="POST" onsubmit="return validatePurchaseForm();">
<div class="container">
  <div class="row h-50">
    <div class="col-md-7">
      <h6><strong>Step 1.</strong> Please provide your details.</h6>

          <input type="hidden" id="event_id" name="event_id" value="<?=$event->id;?>">
          
          <div class="material-textfield">
            <input type="text" id="name" class="fadeIn first material" name="name" placeholder="" onchange="validateFields();">
            <label class="fadeIn first floating">Full name</label>
          </div>
          <div class="field-error-message" style="display:none;" id="error_name">Full name is required.</div>
          <small class="text-form text-success" style="display:none;" id="reminder_name"><i class="fa fa-check-circle"></i> Please make sure your full name is as it appears on your identification.</small>

          <div class="material-textfield">
          <input type="email" id="email" class="fadeIn second material" name="email_address" placeholder="" onchange="validateFields();">
            <label class="fadeIn second floating">Email address</label>
          </div>
          <div class="field-error-message" style="display:none;" id="error_email">Email address is not valid.</div>
          <small class="text-form text-success" style="display:none;" id="reminder_email"><i class="fa fa-check-circle"></i> Please make sure your email address is correct.</small>

          <div class="material-textfield">
            <div class="input-group mb-3">
              <div class="input-group-prepend fadeIn third">
                <span class="input-group-text contact-number-prefix">🇵🇭 +63</span>
              </div>
              <input type="text" id="contact_number" class="fadeIn third form-control material " name="contact_number" placeholder="" onchange="validateFields();">        
              <label class="fadeIn third floating indent">Contact number</label>
            </div>
          </div>
          <div class="field-error-message" style="display:none;" id="error_contact_number">Contact number is required.</div>
          <h6 class="fadeIn fourth"><strong>How many tickets are you getting?</strong></h6>
<?php
    if(isset($remaining_tickets)) {
?>
          <small class="fadeIn fourth"><strong><?=$remaining_tickets;?></strong> tickets available.</small>
<?php
    }
?>
          <div class="input-group mb-3">
            <div class="input-group-prepend fadeIn fourth">
              <span class="input-group-text">Regular - <strong>₱<?=number_format($event->ticket_price, 2);?></strong></span>
            </div>
            <input type="number" min="1" max="<?=$remaining_tickets;?>" step="1" id="number_of_entries" class="fadeIn fourth form-control material" name="number_of_entries" placeholder="" onchange="validateFields();calculateTotal();" onkeyup="validateFields();calculateTotal();">
          </div>
          <div class="field-error-message" style="display:none;" id="error_number_of_entries">Number of tickets is required.</div>

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
      
      
      <div id="divPay">
      <div id="div_paymentCalculation" style="display:none;">
          <hr>
            <h5>Total amount is <b>₱<span id="span_totalAmount">0</span></b>.</h5>
          <hr>
      </div>

      <div class="form-check">
        <input class="form-check-input" type="checkbox" value="" id="checkbox_privacyConsent" onclick="validateFields();">
        <label class="form-check-label field-description" for="checkbox_privacyConsent">
        I agree to share my data to <?=$brand->brand_name;?> and its affiliates for the sole purpose of processing my purchase of tickets.
        </label>
        <div class="field-error-message" style="display:none;" id="error_checkbox_privacyConsent">You need to accept the privacy consent to proceed.</div>
      </div>
      <button id="btnSubmit" type="submit" class="btn btn-primary btn-block btn-lg"><i class="fa fa-credit-card"></i> Proceed to Payment</button>
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
      <span style="font-size:12px; font-style:italic;">Having trouble? Contact us via email <a href="mailto:support@melt-records.com?subject=Issue with ticketing for <?=$event->title;?>">here</a> or use the chat widget on the lower right.</span>
    </p>
  </div>

</div>
</body>