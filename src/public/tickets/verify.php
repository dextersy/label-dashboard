<?
    chdir("../..");
    include_once("./inc/model/brand.php");
    include_once("./inc/model/event.php");
    include_once("./inc/model/ticket.php");

    $event = new Event;
    $event->fromID($_GET['id']);

    $brand = new Brand;
    $brand->fromID($event->brand_id);

    session_start();
    $sessionPIN = $_SESSION['verification_pin'];

    // Check verification PIN
    $verified = ($sessionPIN == $event->verification_pin);
?>
<header>
  <title>Verify tickets for <?=$event->title;?> has been sent!</title>
  <meta content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0' name='viewport' />
    <meta name="viewport" content="width=device-width" />
    <link rel="icon" href="<?=$brand->favicon_url;?>">
    <script src="https://unpkg.com/html5-qrcode" type="text/javascript"></script>
  </header>

<body>
<div id="loadingOverlay" class="loading-overlay" style="display:none;">
  <div class="loading"></div>
</div>

<!--- Camera container --->
<div id="cameraContainer" style="display:none;">
<div class="h-100 d-flex justify-content-center">
  <div class="w-100" style="height:auto;">
    <div id="reader" height="600"></div>
    <div>
    <button type="button" id="btnCancelScan" class="btn btn-primary btn-block"><i class="fa fa-x"></i> Cancel Scanning</i></button> 
    </div>
  </div>
</div>
</div>

<div id="fb-root"></div>
<link href="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" rel="stylesheet" id="bootstrap-css">
<link href="style.css?version=1.8" rel="stylesheet">
<script src="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/latest/css/font-awesome.min.css" />
<script async defer crossorigin="anonymous" src="https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v20.0&appId=1410610449395088" nonce="72nVyoPR"></script>
<script>window.twttr = (function(d, s, id) {
  var js, fjs = d.getElementsByTagName(s)[0],
    t = window.twttr || {};
  if (d.getElementById(id)) return t;
  js = d.createElement(s);
  js.id = id;
  js.src = "https://platform.twitter.com/widgets.js";
  fjs.parentNode.insertBefore(js, fjs);

  t._e = [];
  t.ready = function(f) {
    t._e.push(f);
  };

  return t;
}(document, "script", "twitter-wjs"));</script>
<!------ Include the above in your HEAD tag ---------->

<div class="wrapper h-100 d-flex justify-content-center">

<div class="card mb-3">
    <div class="card-header text-center bg-primary text-white">
      <h3>&nbsp;</h3>
    <h6>Verify tickets for</h6>
    <h4><strong><?=$event->title;?></strong></h4>
    <h5>&nbsp;</h5>
    </div>
    <div class="card-body text-center">
<?
 if (!$verified) { 
  if(isset($_GET['err'])) { 
    ?>
<div class="alert alert-danger" role="alert" id="alert-box">Sorry, you entered the wrong PIN. Please try again.</div>
<? } ?>
  <form id="pinForm" action="action.check-pin.php" method="POST">
    <input type="hidden" name="event_id" value="<?=$_GET['id'];?>" />
    <div class="form-group">
      <label for="labelPIN"><strong>Please input the event PIN to proceed.</strong></label>
      <input type="password" class="form-control form-control-lg text-center" name="pin" id="pwPIN" placeholder="PIN code" />
    </div>
    <button type="submit" class="btn-primary btn-block btn btn-lg"><i class="fa fa-sign-in"></i> Sign In</button>
  </form>
<? 
  } else { 

    if(isset($_GET['err'])) {
  ?>
    <div class="alert alert-danger" role="alert" id="alert-box">Oops! Something went wrong. Please try that again.</div>
  <?
    }
    else if (isset($_GET['success'])) {
  ?>
  <div class="alert alert-success" role="alert" id="alert-box"><i class="fa fa-check-circle" style="font-size:40px;"></i><br>
  <h4><strong>Ticket verified!</strong></h4>
  <p>Please allow entry.</p></div>
  <? 
    } else {
  ?>
    <div class="alert alert-info" role="alert" id="alert-box">You're in! You can now verify tickets below.</div>
  <? } ?>
  <form id="verificationForm" action="action.verify.php" method="POST">
    <input id="hiddenEventID" type="hidden" name="event_id" value="<?=$_GET['id'];?>" />
    <div class="form-group">
      <label for="labelPIN"><strong>Input ticket code</strong></label>
      <div class="input-group">
        <input type="text" class="form-control form-control-lg text-center" name="ticket_code" id="txtTicketCode" placeholder="Ticket code" />
        <div class="input-group-addon">
          <button type="button" id="btnScanQR" class="btn btn-default btn-lg"><i class="fa fa-qrcode"></i></button>
        </div>
      </div>
    </div>
    <div id="divTicketCheck" class="alert alert-success" style="display:none;">
      Please confirm ticket details:<br>
      <strong>Name: </strong><span id="spanTicketName"></span><br>
      <strong>Remaining entries: </strong><span id="spanRemainingEntries"></span>
    </div>
    <div id="divTicketCheckFailed" class="alert alert-danger" style="display:none;">
      The ticket code was not found.
    </div>
    <div id="divTicketCheckClaimed" class="alert alert-danger" style="display:none;">
      This ticket has already been claimed.
    </div>
    <div id="divCheckingIn" style="display:none;"> 
      <div class="form-group">
        <label for="labelNumberOfAttendees"><strong>How many people are checking in?</strong></label>
        <input type="number" class="form-control form-control-lg text-center" min="1" name="number_of_attendees" id="txtNumberOfAttendees" placeholder="Number of attendees" />
        <div class="field-error-message" style="display:none;" id="errorNumberOfAttendees">Number is more than remaining entries.</div>
      </div>
      <button id="btnCheckIn" type="submit" class="btn-primary btn-block btn btn-lg"><i class="fa fa-check-circle"></i> Check In</button>
    </div>
  </form>

<? } ?>
  </div>
  <div class="card-footer" style="padding:0px">
  <?php
      if (isset($event->poster_url) && $event->poster_url != '') {
    ?>
        <img src="<?=$event->poster_url;?>" class="card-img-top" style="max-height:120px;object-fit:cover;filter:blur(2px) brightness(0.8);">
    <?php
      }
    ?>

  </div>
  
</div>

<div class="text-center">
    <p>&nbsp;</p>
    <p>
      <span style="font-size:12px; font-weight:bold;">Powered by Melt Records Dashboard.</span><br>
    </p>
  </div>
</div>


<script type="text/javascript">
  //setup before functions
  var typingTimer;                //timer identifier
  var doneTypingInterval = 500;  //time in ms (2 seconds)

  //on keyup, start the countdown
  $('#txtTicketCode').keyup(function(){
      clearTimeout(typingTimer);
      if ($('#txtTicketCode').val()) {
          typingTimer = setTimeout(getTicketDetails, doneTypingInterval);
      }
  });
  $('#txtTicketCode').on("change", getTicketDetails);

  //user is "finished typing," do something
  function getTicketDetails () {
    $('#loadingOverlay').show();
    $.post(
      '/public/api/get-ticket-from-code.php',
      {
        ticket_code: $('#txtTicketCode').val(),
        event_id: $('#hiddenEventID').val(),
        verification_pin: "<?=$_SESSION['verification_pin'];?>"
      }
    ).done(function(data) {
      
      var ticket = $.parseJSON(data);
      if(ticket.number_of_entries - ticket.number_of_claimed_entries > 0) {
        $('#spanTicketName').html(ticket.name);
        $('#spanRemainingEntries').html(+ticket.number_of_entries - +ticket.number_of_claimed_entries);
        $('#divTicketCheck').show(); $('#divCheckingIn').show();
        $('#divTicketCheckFailed').hide();
        $('#divTicketCheckClaimed').hide();
      }
      else {
        $('#divTicketCheckClaimed').show();
        $('#divTicketCheckFailed').hide();
        $('#divTicketCheck').hide(); 
        $('#divCheckingIn').hide();
      }

      $('#loadingOverlay').hide();

    }).fail(function(response) {
      if(response.status == '404') {
        $('#divTicketCheckFailed').show();
        $('#divTicketCheck').hide(); $('#divCheckingIn').hide(); $('#divTicketCheckClaimed').hide();
      }
      $('#loadingOverlay').hide();
    });
  }

  $('#txtNumberOfAttendees').keyup(function(){
      clearTimeout(typingTimer);
      if ($('#txtNumberOfAttendees').val()) {
          typingTimer = setTimeout(validateNumberOfAttendees, doneTypingInterval);
      }
  });
  $('#txtNumberOfAttendees').on("change", validateNumberOfAttendees);
  function validateNumberOfAttendees() {
    let numberOfAttendees = +$('#txtNumberOfAttendees').val();
    let remaining = +$('#spanRemainingEntries').html();
    if (numberOfAttendees > remaining) {
      $('#errorNumberOfAttendees').show();
      $('#txtNumberOfAttendees').addClass("error");
      $('#btnCheckIn').prop('disabled', true);
    }
    else {
      $('#errorNumberOfAttendees').hide();
      $('#txtNumberOfAttendees').removeClass("error");
      $('#btnCheckIn').prop('disabled', false);
    }
  }

  setTimeout(function() {
      $('#alert-box').fadeOut('fast');
  }, 2500); // <-- time in milliseconds
</script>

<!-- QRCode Scanner -->
<script type="text/javascript">

  function beep() {
    var context = new AudioContext();
    var oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = 800;
    oscillator.connect(context.destination);
    oscillator.start();
    // Beep for 500 milliseconds
    setTimeout(function () {
        oscillator.stop();
    }, 200);
  }
  const html5QrCode = new Html5Qrcode("reader");
  $('#btnScanQR').on('click', function() {
    $('#cameraContainer').show();

    // This method will trigger user permissions
    html5QrCode.start(
      { facingMode: "environment" }, 
      {
        fps: 10,    // Optional, frame per seconds for qr code scanning
        qrbox: { width: 250, height: 250 }
      },
      (decodedText, decodedResult) => {
        beep();
        $('#txtTicketCode').val(decodedText); getTicketDetails();
        $('#cameraContainer').hide();
        html5QrCode.stop();
      },
      (errorMessage) => {
        // Don't do anything
      })
    .catch((err) => {
      // Start failed, handle it.
    });
  });

  $('#btnCancelScan').on('click', function() {
    $('#cameraContainer').hide();
    html5QrCode.stop();
  });


  
</script>
</body>