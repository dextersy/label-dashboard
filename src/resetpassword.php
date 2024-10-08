<?
  require_once('./inc/util/Redirect.php');
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

  include_once('./inc/view/login/header.php');
?>
  <div id="formHeader" style="background-color:<?=$_SESSION['brand_color'];?>;">
    <div class="fadeIn first">
      <img src="<?=$_SESSION['brand_logo'];?>" id="icon" alt="<?=$_SESSION['brand_name'];?>" />
    </div>
  </div>
  <div id="formContent">
    <?
      if ($error) {
    ?>
      <div class="alert alert-danger" role="alert">
        The link you used is invalid. <a href="index.php">Please try again.</a>
      </div>
    <? } else {
      if($_GET['err'] == 'mismatch') { ?>
      <div class="alert alert-danger" role="alert">
        The passwords you input were mismatched. Please try again.
      </div>
    <? } ?>
    <h3><strong>New Password, New You! ✨</strong></h3>
    <small class="text-muted">Please set your new password to complete your account recovery.</small>
    <form action="action.init-user.php" method="POST">
      <input type="hidden" name="id" value="<?=$user->id;?>">
      <input type="hidden" name="reset_hash" value="<?=$_GET['code'];?>">
      <input type="password" id="password" class="fadeIn second" name="password" placeholder="New Password" required>
      <input type="password" id="validation" class="fadeIn third" name="validation" placeholder="Verify New Password" required>
      <input type="submit" class="fadeIn fourth btn btn-primary btn-block" style="margin-top:20px;" value="Set New Password">
    </form>
    <? } ?>

  </div>
  <div id="formFooter">
    <a class="" href="index.php">Back to login</a>
  </div>
<? include_once('./inc/view/login/footer.php'); ?>