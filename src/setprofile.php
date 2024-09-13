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
<link href="assets/css/login.css?version=1.3" rel="stylesheet">
<script src="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js"></script>
<script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
<!------ Include the above in your HEAD tag ---------->

<div class="wrapper fadeInDown">
  <div id="formHeader" style="background-color:<?=$_SESSION['brand_color'];?>;">
    <!-- Tabs Titles -->

    <!-- Icon -->
    <div class="fadeIn first">
      <img src="<?=$_SESSION['brand_logo'];?>" id="icon" alt="<?=$_SESSION['brand_name'];?>" />
    </div>
  </div>
  <div id="formContent">
    <form action="action.init-user.php" method="POST">

    <!-- Login Form -->
    <p><strong>Please update your profile.</strong></p>
      <input type="hidden" name="brand_id" value="<?=$user->brand_id;?>">
      <input type="hidden" name="id" value="<?=$user->id;?>">
      <input type="hidden" name="invite_hash" value="<?=$artistAccess->invite_hash;?>">
      <input type="hidden" name="is_admin" value="<?=$user->is_admin;?>">
      <? if (!isset($user->username) || $user->username == '') { ?> 
      <div class="material-textfield">
        <input type="text" id="txt_username" class="fadeIn second material" name="username" placeholder="" value="<?=$user->username;?>" required>
        <label class="floating" for="txt_username">Username</label>
      </div>
      <? } ?>
      <div class="material-textfield">
        <input type="text" id="txt_firstName" class="fadeIn second material" name="first_name" placeholder="" value="<?=$user->first_name;?>" required>
        <label class="floating" for="txt_firstName">First name</label>
      </div>

      <div class="material-textfield">
        <input type="text" id="txt_lastName" class="fadeIn second material" name="last_name" placeholder="" value="<?=$user->last_name;?>" required>
        <label class="floating" for="txt_lastName">Last name</label>
      </div>

      <div class="material-textfield">
        <input type="password" id="pass_password" class="fadeIn second material" name="password" placeholder="" required>
        <label class="floating" for="pass_password">Password</label>
      </div>

      <input type="submit" class="fadeIn third btn btn-primary btn-block" value="Save Changes">
    </form>
  </div>
</div>
</body>