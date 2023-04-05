<?
    chdir("../..");
    include_once("./inc/model/brand.php");
    include_once("./inc/model/event.php");

    $event = new Event;
    $event->fromID($_GET['id']);

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
<link href="style.css?version=1.1" rel="stylesheet">
<script src="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<!------ Include the above in your HEAD tag ---------->

<div class="wrapper fadeInDown">
    <div id="formHeader">
      <table style="border:0px">
      <tr><td width="25%"><img src="../../<?=$event->poster_url;?>" width="90%"></td>
      <td width="75%"><h1 style="color:black;">Buy tickets to <strong><?=$event->title;?></strong></h1>
      <h4>Step 1. Please provide your details.</h4>
    </td></tr>
    </table>
    <br><br>
    
</div>
  <div id="formContent" style="background-color:<?=$brand->brand_color;?>;">
    <!-- Tabs Titles -->


    <!-- Alert -->
    <?
      if ($_GET['err'] == 'no_user') {
    ?>
      <div class="alert alert-danger" role="alert">
        User not found. Please try again or ask admin to invite you.
      </div>
    <? }
      else if ($_GET['err'] == 'pass') {
    ?>
      <div class="alert alert-danger" role="alert">
        Wrong password. Please try again.
      </div>
    <?
      }
      else if ($_GET['err'] == 'invalid_hash') {
    ?>
      <div class="alert alert-danger" role="alert">
        Invalid code. Please request invite again.
      </div>
    <?
      }
    ?>
    <!-- Login Form -->
    <form action="action.buy.php" method="POST">
      <input type="hidden" id="event_id" name="event_id" value="<?=$event->id;?>">
      <input type="text" id="name" class="fadeIn second" name="name" placeholder="Your Name">
      <input type="email" id="email" class="fadeIn third" name="email_address" placeholder="Your Email Address">
      <input type="text" id="contact_number" class="fadeIn fourth" name="contact_number" placeholder="Contact Number">
      <input type="text" id="number_of_entries" class="fadeIn fifth" name="number_of_entries" placeholder="How many tickets?">
      <input type="submit" class="fadeIn sixth" value="Order Tickets">
    </form>

    <!-- Remind Passowrd -->
    <div id="formFooter">
    <p style="font-size:12px;">Your payment link will be displayed after placing your order.</p>
    </div>
  </div>
</div>
</body>