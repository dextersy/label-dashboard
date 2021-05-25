<?php
  require_once("./inc/model/user.php");

  $hash = $_GET['u'];
  $user = new User;
  $user->fromInviteHash($hash);
?>
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

    <!-- Login Form -->
    <p><strong>Please update your profile.</strong></p>
    <form action="action.init-user.php" method="POST">
      <input type="hidden" name="id" value="<?=$user->id;?>">
      <input type="hidden" name="invite_hash" value="<?=$user->invite_hash;?>">
      <input type="hidden" name="is_admin" value="<?=$user->is_admin;?>">
      <input type="text" id="login" class="fadeIn second" name="username" placeholder="username" value="<?=$user->username;?>">
      <input type="text" id="login" class="fadeIn second" name="email_address" placeholder="email" value="<?=$user->email_address;?>">
      <input type="text" id="login" class="fadeIn second" name="first_name" placeholder="First name" value="<?=$user->first_name;?>">
      <input type="text" id="login" class="fadeIn second" name="last_name" placeholder="Last name" value="<?=$user->last_name;?>">
      <input type="password" id="password" class="fadeIn third" name="password" placeholder="password">
      <input type="submit" class="fadeIn fourth" value="Save Changes">
    </form>
  </div>
</div>