<?php include_once('./inc/view/header.php'); ?>
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
            <h3>Update Your Profile</h3>
            <form action="action.init-user.php" method="POST">
            <div class="form-group">
                <input type="hidden" name="id" value="<?=$user->id;?>">
                <input type="hidden" name="brand_id" value="<?=$user->brand_id;?>">
            </div>
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
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" class="form-control" name="password" placeholder="password">
                </div>
                <input type="submit" class="btn btn-primary" value="Save Changes">
            </form>
            </div>

    </div>
</div>


</body>
<? include_once('inc/view/footer.php'); ?>

</html>
