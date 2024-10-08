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
  <div id="formHeader" style="background-color:<?=$_SESSION['brand_color'];?>;">
    <!-- Tabs Titles -->

    <!-- Icon -->
    <div class="fadeIn first">
      <img src="<?=$_SESSION['brand_logo'];?>" id="icon" alt="<?=$_SESSION['brand_name'];?>" />
    </div>
  </div>
  <div id="formContent">
    <form id="formSetProfile" action="action.init-user.php" method="POST">

    <!-- Login Form -->
    <h3><strong>Almost there! 🏁</strong></h3>
    <small>Please update your profile information so we can set up your account correctly.</small>
      <input id="hidden_brandID" type="hidden" name="brand_id" value="<?=$user->brand_id;?>">
      <input type="hidden" name="id" value="<?=$user->id;?>">
      <input type="hidden" name="invite_hash" value="<?=$artistAccess->invite_hash;?>">
      <input type="hidden" name="is_admin" value="<?=$user->is_admin;?>">
      <? if (!isset($user->username) || $user->username == '') { ?> 
      <div class="material-textfield">
        <input type="text" id="txt_username" class="fadeIn second material" name="username" placeholder="" value="<?=$user->username;?>" required>
        <label class="floating" for="txt_username">Username</label>
      </div>
      <div id="error_txt_usernameRequired" class="field-error-message" style="display:none;"><i class="fa fa-warning"></i> Username is required.</div>
      <div id="errorUsernameInvalid" class="field-error-message" style="display:none;"><i class="fa fa-warning"></i> Only alphanumeric characters [A-Z, a-z, 0-9] and underscores are allowed.</div>
      <div id="errorUsernameExists" class="field-error-message" style="display:none;"><i class="fa fa-warning"></i> Sorry, this username is already in use. Please choose another.</div>
      <small id="infoUsername" class="text-success" style="display:none;"><i class="fa fa-check-circle"></i> Username can no longer be changed once saved.</small>

      <? } ?>
      <div class="material-textfield">
        <input type="text" id="txt_firstName" class="fadeIn second material" name="first_name" placeholder="" value="<?=$user->first_name;?>" required>
        <label class="floating" for="txt_firstName">First name</label>
      </div>
      <div id="error_txt_firstNameRequired" class="field-error-message" style="display:none;"><i class="fa fa-warning"></i> First name is required.</div>
      
      <div class="material-textfield">
        <input type="text" id="txt_lastName" class="fadeIn second material" name="last_name" placeholder="" value="<?=$user->last_name;?>" required>
        <label class="floating" for="txt_lastName">Last name</label>
      </div>
      <div id="error_txt_lastNameRequired" class="field-error-message" style="display:none;"><i class="fa fa-warning"></i> Last name is required.</div>
      
      <div class="material-textfield">
        <input type="password" id="pass_password" class="fadeIn second material" name="password" placeholder="" required>
        <label class="floating" for="pass_password">Password</label>
      </div>
      <div id="error_pass_passwordRequired" class="field-error-message" style="display:none;"><i class="fa fa-warning"></i> Password is required.</div>

      <div class="material-textfield">
        <input type="password" id="pass_confirmPassword" class="fadeIn second material" name="confirm_password" placeholder="" required>
        <label class="floating" for="pass_password">Confirm password</label>
      </div>
      <div id="error_pass_confirmPasswordRequired" class="field-error-message" style="display:none;"><i class="fa fa-warning"></i> Please confirm your chosen password.</div>
      <div id="error_passwordMismatch" class="field-error-message" style="display:none;"><i class="fa fa-warning"></i> Oops, the passwords did not match. Please check your password again.</div>

      <input id="btnSubmit" type="submit" class="fadeIn third btn btn-primary btn-block" style="margin-top:20px;" value="Save Changes">
    </form>
  </div>

<script type="text/javascript">
  //setup before functions
  var typingTimer;                //timer identifier
  var doneTypingInterval = 500;  //time in ms (2 seconds)

  //on keyup, start the countdown
  function startTimer() {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(validateFields, doneTypingInterval);
  }

  $(document).ready(function() {
    $('input[type="text"]').keyup(startTimer);
    $('input[type="password"]').keyup(startTimer);
    $('input[type="text"]').on("change", validateFields);
    $('input[type="password"]').on("change", validateFields);

    $('#btnSubmit').on('click', async function(e) {
      e.preventDefault();
      if (await validateForm()) {
        $('#formSetProfile').submit(); // Manually trigger form submission
      }
    });
  });
  
  async function validateForm() {
    await validateFields();
    var errorFields = document.getElementsByClassName('error');
    console.log(errorFields);
    if(errorFields.length > 0) {
      console.log(errorFields.length);
      errorFields[0].focus();
      return false;
    }
    return true;
  }
  //user is "finished typing," do something
  async function validateFields () {
    $('#loadingOverlay').show();

    // Validate username
    $('#errorUsernameExists').hide(); 
    $('#errorUsernameInvalid').hide();
    $('#infoUsername').hide();

    if(validateRequiredField('txt_username')) {
      // Check username valid
      let pattern = /^[A-Za-z0-9_]+$/g;
      if(!pattern.test($('#txt_username').val())) {
        $('#errorUsernameInvalid').show();
        markErrorField('#txt_username');
      }
      else {
        // Check username exists
        await $.post(
          '/public/api/check-username-exists.php',
          {
            brand_id: $('#hidden_brandID').val(),
            username: $('#txt_username').val(),
          }
        ).done(function(data) {
          var json = $.parseJSON(data);
          if(json.result == 'true') {
            $('#errorUsernameExists').show(); 
            markErrorField('#txt_username');
          }
          else {
            $('#infoUsername').show();
          }
        }).fail(function(response) {
          // do nothing, but maybe I should do something?
        });
      }
    }

    // Validate other fields
    validateRequiredField('txt_firstName');
    validateRequiredField('txt_lastName');
   
    // Validate passwords
    removeErrorField('#pass_password');
    removeErrorField('#pass_confirmPassword')
    if (validateRequiredField('pass_password') && validateRequiredField('pass_confirmPassword')) {
      if ($('#pass_password').val() != $('#pass_confirmPassword').val()) {
        $('#error_passwordMismatch').show();
        markErrorField('#pass_password');
        markErrorField('#pass_confirmPassword')
      }
      else {
        $('#error_passwordMismatch').hide();
      }
    }
    else {
      $('#error_passwordMismatch').hide();
    }
    $('#loadingOverlay').hide();
  }

  function validateRequiredField(fieldname) {
    if($('#' + fieldname).val() == '') {
      $('#error_' + fieldname + "Required").show();
      markErrorField("#" + fieldname);
      return false;
    }
    else {
      $('#error_' + fieldname + "Required").hide();
      removeErrorField("#" + fieldname);
      return true;
    }
  }
  function markErrorField(fieldname) {
    $(fieldname).addClass('error');
  }
  function removeErrorField(fieldname) {
    $(fieldname).removeClass('error');
  }
</script>

<? include_once('./inc/view/login/footer.php'); ?>