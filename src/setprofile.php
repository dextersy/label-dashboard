<?php
  require_once("./inc/model/user.php");
  require_once("./inc/model/artistaccess.php");
  require_once("./inc/util/Redirect.php");
  include_once('./inc/controller/block_check.php');
  require_once("./inc/controller/brand_check.php");
  session_start();

  if ($_GET['u']) {
    $hash = $_GET['u'];
    $artistAccess = new ArtistAccess;
    $artistAccess->fromInviteHash($hash);

    if(!isset($artistAccess->artist_id)) {
      redirectTo('/index.php?err=invalid_hash');
    }
    else {
      $user = new User;
      $user->fromID($artistAccess->user_id);
      if(isset($user->password_md5) && $user->password_md5 != "") {
        $artistAccess->status = "Accepted";
        $artistAccess->invite_hash = "";
        $artistAccess->saveUpdates();
        redirectTo("/dashboard.php");
      }
    }
  }
  else {
    redirectTo('/index.php?err=invalid_hash');
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

<?php include('./inc/view/after-body.php'); ?>
<link href="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" rel="stylesheet" id="bootstrap-css">
<link href="assets/css/login.css" rel="stylesheet">
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

    <!-- Login Form -->
    <p><strong>Please update your profile.</strong></p>
    <form action="action.init-user.php" method="POST">
      <input type="hidden" name="brand_id" value="<?=$user->brand_id;?>">
      <input type="hidden" name="id" value="<?=$user->id;?>">
      <input type="hidden" name="invite_hash" value="<?=$artistAccess->invite_hash;?>">
      <input type="hidden" name="is_admin" value="<?=$user->is_admin;?>">
      <? if (!isset($user->username) || $user->username == '') { ?> 
        <input type="text" id="login" class="fadeIn second" name="username" placeholder="username" value="<?=$user->username;?>">
      <? } ?>
      <input type="text" id="login" class="fadeIn second" name="first_name" placeholder="First name" value="<?=$user->first_name;?>">
      <input type="text" id="login" class="fadeIn second" name="last_name" placeholder="Last name" value="<?=$user->last_name;?>">
      <input type="password" id="password" class="fadeIn third" name="password" placeholder="password">
      <input type="submit" class="fadeIn fourth" value="Save Changes">
    </form>
  </div>
</div>
</body>