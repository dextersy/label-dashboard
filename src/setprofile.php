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

  include_once('./inc/view/login/header.php');
?>
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
<? include_once('./inc/view/login/footer.php'); ?>