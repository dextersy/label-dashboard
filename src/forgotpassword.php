<?
  require_once('./inc/util/Redirect.php');
  include_once('./inc/controller/block_check.php');
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

      if ($_GET['err'] == 'sent' ) {
    ?>
    <h5><strong>Password reset link sent!</strong></h5>
    <p>Please check your email and access the link to reset your password. You may now close this window.</p>
    <?
      } else {
    ?>
    <form action="action.send-reset-link.php" method="POST">
      <input type="email" id="email_address" class="fadeIn second" name="email_address" placeholder="Email address" required>
      <input type="submit" class="fadeIn fourth btn btn-primary btn-block" value="Send Password Reset Link">
    </form>
    <? } ?>

  </div>
  <div id="formFooter">
    <a class="" href="index.php">Back to login</a>
  </div>

</div>
<? include_once('./inc/view/login/footer.php'); ?>