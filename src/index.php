<?
  require_once('./inc/util/Redirect.php');
  require_once('./inc/config.php');
  include_once('./inc/controller/brand_check.php');
  session_start();
  if($_SESSION['logged_in_user'] != null) {
    redirectTo('/dashboard.php');
  }

  include_once('./inc/view/login/header.php');
?>
<div class="wrapper fadeInDown">
  <div id="formHeader" style="background-color:<?=$_SESSION['brand_color'];?>;">
    <div class="fadeIn first">
      <img src="<?=$_SESSION['brand_logo'];?>" id="icon" alt="<?=$_SESSION['brand_name'];?>" />
    </div>
  </div>
  <div id="formContent">
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
      else if ($_GET['err'] == 'lock') {
    ?>
      <div class="alert alert-danger" role="alert">
        Your account is locked due to too many failed logins. Try again in <?=LOCK_TIME_IN_SECONDS/60;?> minutes.
      </div>
    <?
      }else if ($_GET['resetpass'] == '1') {
    ?>
      <div class="alert alert-success" role="alert">
        Your password has been successfully reset. Please log in again.
      </div>
    <?
      }
    ?>
    <!-- Login Form -->
    <form action="action.login.php" method="POST">
    <? if (isset($_GET['url'])) { ?>
      <input type="hidden" name="redirectTo" value="<?=$_GET['url'];?>" />
    <? } ?>
      <div class="input-group">
        <div class="input-group-prepend">
          <span class="input-group-text fadeIn second" style="background-color:#f6f6f6;border:0px;"><i class="fa fa-user"></i></span>
        </div>
        <input type="text" id="login" class="fadeIn second form-control" name="login" placeholder="login" required>
      </div>
      &nbsp;
      <div class="input-group">
        <div class="input-group-prepend">
          <span class="input-group-text fadeIn third" style="background-color:#f6f6f6;border:0px;"><i class="fa fa-unlock-alt"></i></span>
        </div>
        <input type="password" id="password" class="fadeIn third form-control" name="password" placeholder="password" required>
      </div>
      &nbsp;
      <button type="submit" class="fadeIn fourth btn btn-primary btn-block btn-md">Log In <i class="fa fa-sign-in"></i></button>
    </form>
  </div>
  <!-- Remind Passowrd -->
  <div id="formFooter">
    <a class="" href="forgotpassword.php">Forgot Password?</a>
  </div>
</div>
<? include_once('./inc/view/login/footer.php'); ?>