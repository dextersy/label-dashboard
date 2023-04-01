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
  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','GTM-KQHJ23P');</script>
  <!-- End Google Tag Manager -->
</header>

<body>
  <!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-KQHJ23P"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
<link href="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" rel="stylesheet" id="bootstrap-css">
<link href="style.css" rel="stylesheet">
<script src="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<!------ Include the above in your HEAD tag ---------->

<div class="wrapper fadeInDown">
    <div id="formHeader">
    <h1 style="color:black;">Thank you for your order!</strong></h1>
    <p>Your tickets are reserved. Please continue to the payment link below to finish your order.</p>
</div>
  <div id="formContent">
    <p>The total amount for your order is </p>
    <h1><?=money_format("Php %i", $ticket->number_of_entries * $event->ticket_price)?></h1>
    <!-- Tabs Titles -->
    <!-- Login Form -->
      <input type="button" value="Pay for Tickets">
    <!-- Remind Passowrd -->
    <div id="formFooter">
    <p style="font-size:12px;">Upon completing your payment, please give us 2 to 3 days to verify and send your ticket.</p>
    </div>
  </div>
</div>
</body>