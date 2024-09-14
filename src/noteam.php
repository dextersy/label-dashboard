<?php
    include_once('./inc/view/login/header.php');
?>

<div class="wrapper fadeInDown">
  <div id="formHeader" style="background-color:<?=$_SESSION['brand_color'];?>;">
    <div class="fadeIn first">
      <img src="<?=$_SESSION['brand_logo'];?>" id="icon" alt="<?=$_SESSION['brand_name'];?>" />
    </div>
  </div>
  <div id="formContent">
      <h3><strong>You are not yet part of an artist team.</strong></h3>
      <p>Please ask your band or label administrator to invite you to your artist team.</p>
  </div>
  <div id="formFooter">
    <a href="logout.php">
      <button type="button" class="fadeIn fourth btn btn-primary btn-block">Sign Out <i class="fa fa-sign-out"></i></button>
    </a>
  </div>

</div>
<? include_once('./inc/view/login/footer.php'); ?>