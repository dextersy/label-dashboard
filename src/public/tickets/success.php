<?
    chdir("../..");
    include_once("./inc/model/brand.php");
    include_once("./inc/model/event.php");
    include_once("./inc/model/ticket.php");

    $event = new Event;
    $event->fromID($_GET['id']);

    $brand = new Brand;
    $brand->fromID($event->brand_id);
?>
<header>
  <title>Your ticket to <?=$event->title;?> has been sent!</title>
  <meta content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0' name='viewport' />
    <meta name="viewport" content="width=device-width" />
</header>

<body>
<div id="fb-root"></div>
<link href="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" rel="stylesheet" id="bootstrap-css">
<link href="style.css?version=1.6" rel="stylesheet">
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

<div class="wrapper">
    <div id="formHeader">
<div class="card">

<div class="card-header">

<?php
  if (isset($event->poster_url) && $event->poster_url != '') {
?>
    <img src="../../<?=$event->poster_url;?>" width="30%">
<?php
  }
?>
<br>
&nbsp;
    <h3 style="color:black;font-weight:bold;text-transform:uppercase;">Congrats! You're in!</strong></h1>
</div>

<div class="card-body">
    <p><i class="fa fa-check-circle" style="font-size:150px;color:green;"></i></p>
    <h3>Thank you for your purchase!</h3>
    <p>Your tickets to <strong><?=$event->title;?></strong> have been sent to your email address.</p>

    <div class="alert alert-secondary field-description belowTitle text-dark text-left"><i class="fa fa-info-circle"></i> <b>How to use your ticket</b><br>
      <ul>
        <li>Print out a copy of your ticket or show the email you received with your name and ticket code at the gate.</li>
        <li>You may be required to provide identification to verify your ticket at the gate.</li>
        <li>Didn't receive your ticket? Don't worry, we're ready help. Just send us an email at <a href="mailto:support@melt-records.com">support@melt-records.com</a> or message us on our Facebook page <a href="https://m.me/meltrecordsph"><u>here</u></a>.</li>
      </ul>
    </div>
  </div>
</div>
<div class="card-footer">
    <div class="row">
    <div class="col-md-12 text-center">
      <p>
      <strong>Tell your friends about this show!</strong>
      <br>
      <span class="fb-share-button" data-href="<?=$event->buy_shortlink;?>" data-layout="button" data-size="large">
        <a target="_blank" href="https://www.facebook.com/sharer/sharer.php?u=<?=urlencode($event->buy_shortlink);?>&amp;src=sdkpreparse" class="fb-xfbml-parse-ignore">Share</a>
      </span>&nbsp;
      <a class="twitter-share-button"
          href="https://twitter.com/intent/tweet?text=<?=urlencode("Join me at " . $event->title . "! You can get your ticket here: " . $event->buy_shortlink);?>"
          data-size="large">
      Tweet</a>
      </p>
    </div>
  </div>
</div>
</div>
</div>
</div>
</body>