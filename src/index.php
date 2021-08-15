<?
  require_once('./inc/util/Redirect.php');

  session_start();
  if($_SESSION['logged_in_user'] != null) {
    redirectTo('/dashboard.php');
  }
?>
<header>
  <title>Melt Dashboard Beta</title>
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
<link href="assets/css/login.css" rel="stylesheet">
<script src="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<!------ Include the above in your HEAD tag ---------->

<div class="wrapper fadeInDown">
  <div id="formContent">
    <!-- Tabs Titles -->

    <!-- Icon -->
    <div class="fadeIn first">
      <img src="assets/img/logo-purple.png" id="icon" alt="Melt Records" />
    </div>

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
    <form action="action.login.php" method="POST">
      <input type="text" id="login" class="fadeIn second" name="login" placeholder="login">
      <input type="password" id="password" class="fadeIn third" name="password" placeholder="password">
      <input type="submit" class="fadeIn fourth" value="Log In">
    </form>

    <!-- Remind Passowrd -->
    <div id="formFooter">
      <a class="underlineHover" href="#">Forgot Password?</a>
    </div>

  </div>
</div>
</body>