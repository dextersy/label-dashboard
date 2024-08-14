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
<link href="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" rel="stylesheet" id="bootstrap-css">
<link href="style.css?version=1.3" rel="stylesheet">
<script src="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
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
    <p style="font-size:12px">This link will redirect you to our external payment provider. The payee information will be <b>Melt Records Music Publishing Inc.</b>.</p>
    <p style="font-size:12px;">Upon completing your payment, please give us 2 to 3 days to verify and send your ticket.</p>
    </div>
  </div>
</div>
</body>