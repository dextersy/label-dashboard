<?
    chdir("../..");
    include_once("./inc/model/brand.php");
    include_once("./inc/model/event.php");
    include_once("./inc/model/ticket.php");

    $ticket = new Ticket;
    $ticket->fromID($_GET['id']);

    $event = new Event;
    $event->fromID($ticket->event_id);

    $brand = new Brand;
    $brand->fromID($event->brand_id);
?>
<header>
  <title>Buy tickets to <?=$event->title;?></title>
  <meta content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0' name='viewport' />
    <meta name="viewport" content="width=device-width" />
</header>

<body>
<div id="fb-root"></div>
<link href="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" rel="stylesheet" id="bootstrap-css">
<link href="style.css?version=1.3" rel="stylesheet">
<script src="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
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
    <img src="../../<?=$event->poster_url;?>" width="30%">
    <h1 style="color:black;">Thank you for your order!</strong></h1>
    <p>Your tickets to <strong><?=$event->title;?></strong> are reserved. Please continue to the payment link below to finish your order.</p>
</div>
  <div id="formContent">
    <p>The total amount for your order is </p>
    <h1>Php <?=number_format($ticket->number_of_entries * $event->ticket_price,2)?></h1>
    <!-- Tabs Titles -->
    <!-- Login Form -->
    <a href="<?=$ticket->payment_link;?>">
      <button class="paymentLinkButton">Pay for Tickets</button>
    </a>
    <p style="font-size:12px"><em>This link has also been sent to your email.</em></p>
    <!-- Remind Passowrd -->
    <div id="formFooter">
    <p style="font-size:12px">This link will redirect you to our external payment provider. The payee information should show as <b>Melt Records Music Publishing Inc.</b>.
    <br>Upon completing your payment, please give us 2 to 3 days to verify and send your ticket.</p>
    <hr>
    <div class="row">
    <div class="col-md-12">
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
</body>