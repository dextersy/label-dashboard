<?
  require_once('./inc/util/Redirect.php');
  include_once('./inc/controller/block_check.php');
  require_once('./inc/model/user.php');

  include_once('./inc/controller/brand_check.php');
  session_start();
  if($_SESSION['logged_in_user'] != null) {
    redirectTo('/dashboard.php');
  }

  if ($_GET['code']) {
    $user = new User;
    if(!$user->fromResetHash($_SESSION['brand_id'], $_GET['code'])) {
      $error = true;
    }
  } else {
    $error = true;
  }
?>
<header>
  <title><?=$_SESSION['brand_name'];?> Dashboard Beta</title>
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
<link href="assets/css/login.css?version=1.2" rel="stylesheet">
<script src="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<!------ Include the above in your HEAD tag ---------->

<div class="wrapper fadeInDown">
  <div id="formContent" style="background-color:<?=$_SESSION['brand_color'];?>;">
    <!-- Tabs Titles -->

    <!-- Icon -->
    <div class="fadeIn first">
      <img src="<?=$_SESSION['brand_logo'];?>" id="icon" alt="<?=$_SESSION['brand_name'];?>" />
    </div>

    <!-- Alert -->
    <?
      if ($error) {
    ?>
      <div class="alert alert-danger" role="alert">
        The link you used is invalid. <a href="index.php">Please try again.</a>
      </div>
    <? } else {
    ?>
    <!-- Login Form -->
    <form action="action.init-user.php" method="POST">
      <input type="hidden" name="id" value="<?=$user->id;?>">
      <input type="password" id="password" class="fadeIn second" name="password" placeholder="New Password" required>
      <input type="password" id="validation" class="fadeIn third" name="validation" placeholder="Verify New Password" required>
      <input type="submit" class="fadeIn fourth" value="Set New Password">
    </form>
    <? } ?>

    <!-- Remind Passowrd -->
    <div id="formFooter">
      <a class="underlineHover" href="index.php">Back to login</a>
    </div>

  </div>
</div>
</body>