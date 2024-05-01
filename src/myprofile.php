<?php include_once('./inc/view/header.php'); ?>
<script type="text/javascript">
    function onClickChangePassword() {
        document.getElementById('password-change').style.display = 'block';
        document.getElementById('password-no-change').style.display = 'none';
    }
    function onClickCancelPasswordChange() {
        document.getElementById('password-change').style.display = 'none';
        document.getElementById('password-no-change').style.display = 'block';
        document.getElementById('new_password').value = "";
    }
</script>
<script src="https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js"></script>
    <script type="text/javascript">
        setTimeout(function() {
            $('#alert-box').fadeOut('fast');
        }, 2500); // <-- time in milliseconds
    </script>
<body>
<?php include('./inc/view/after-body.php'); ?>
<div class="wrapper">
    <?php include_once('inc/view/sidebar.php'); ?>

    <div class="main-panel">
        <?php include_once('inc/view/navbar.php'); ?>
    
<?php
    include_once('./inc/model/user.php');

    $user = new User;
    $user->fromID($_SESSION['logged_in_user']);
?>
   
            <div class="container-fluid">

<? if($_GET['err']=='mismatch') { ?>
    <div class="alert alert-danger" id="alert-box" role="alert">
        The passwords did not match. Please try again.
    </div>
<? } else if ($_GET['err'] == 'wrong_password') { ?>
    <div class="alert alert-danger" id="alert-box" role="alert">
        Old password input was incorrect. Please try again.
    </div>
<? } else if ($_GET['err'] == '0') { ?>
    <div class="alert alert-success" id="alert-box" role="alert">
        Successfully updated your profile.
    </div>
<? } ?>
            <h3>Update Your Profile</h3>
            <form action="action.init-user.php" method="POST">
            <input type="hidden" name="id" value="<?=$user->id;?>">
            <input type="hidden" name="brand_id" value="<?=$user->brand_id;?>">
            <input type="hidden" name="origin" value="myprofile">
            <div class="form-group">
                <input type="hidden" name="is_admin" value="<?=$user->is_admin;?>">
                </div>
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="login" class="form-control" name="username" placeholder="Username" value="<?=$user->username;?>" readonly>
                </div>
            <div class="form-group">
                <label for="email_address">Email address</label>
                <input type="text" id="login" class="form-control" name="email_address" placeholder="Email address" value="<?=$user->email_address;?>" readonly>
                </div>
            <div class="form-group">
                <label for="first_name">First name</label>
                <input type="text" id="login" class="form-control" name="first_name" placeholder="First name" value="<?=$user->first_name;?>">
                </div>
            <div class="form-group">
                <label for="last_name">Last name</label>
                <input type="text" id="login" class="form-control" name="last_name" placeholder="Last name" value="<?=$user->last_name;?>">
                </div>
            <div class="form-group" id="password-no-change">
                <label for="password">Password</label>
                <br>••••••••• <a href="#" onclick="onClickChangePassword();">[ Change ]</a></label>
                </div>
            <div class="form-group" id="password-change" style="display:none">
                <label for="password">Old password</label>
                <input type="password" id="old_password" class="form-control" name="old_password" placeholder="password">
                <label for="password">New password</label>
                <input type="password" id="new_password" class="form-control" name="new_password" placeholder="password">
                <label for="confirm_password">Confirm password</label>
                <input type="password" id="confirm_password" class="form-control" name="confirm_password" placeholder="password">
                <br><a href="#" onclick="onClickCancelPasswordChange();">[ Cancel ]</a>
            </div>
                <input type="submit" class="btn btn-primary" value="Save Changes">
            </form>
            </div>

    </div>
</div>


</body>
<? include_once('inc/view/footer.php'); ?>

</html>
