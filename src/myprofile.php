<?php include_once('./inc/view/header.php'); ?>
<body>

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
            </div>
            <div class="form-group">
                <input type="hidden" name="is_admin" value="<?=$user->is_admin;?>">
                </div>
            <div class="form-group">
                <input type="text" id="login" class="form-control" name="username" placeholder="username" value="<?=$user->username;?>">
                </div>
            <div class="form-group">
                <input type="text" id="login" class="form-control" name="email_address" placeholder="email" value="<?=$user->email_address;?>">
                </div>
            <div class="form-group">
                <input type="text" id="login" class="form-control" name="first_name" placeholder="First name" value="<?=$user->first_name;?>">
                </div>
            <div class="form-group">
                <input type="text" id="login" class="form-control" name="last_name" placeholder="Last name" value="<?=$user->last_name;?>">
                </div>
            <div class="form-group">
                <input type="password" id="password" class="form-control" name="password" placeholder="password">
                </div>
                <input type="submit" class="btn btn-primary" value="Save Changes">
            </form>
            </div>

    </div>
</div>


</body>

        <!--   Core JS Files   -->
    <script src="assets/js/jquery.3.2.1.min.js" type="text/javascript"></script>
	<script src="assets/js/bootstrap.min.js" type="text/javascript"></script>

	<!--  Charts Plugin -->
	<script src="assets/js/chartist.min.js"></script>

    <!--  Notifications Plugin    -->
    <script src="assets/js/bootstrap-notify.js"></script>

    <!-- Light Bootstrap Table Core javascript and methods for Demo purpose -->
	<script src="assets/js/light-bootstrap-dashboard.js?v=1.4.0"></script>

	<!-- Light Bootstrap Table DEMO methods, don't include it in your project! -->
	<script src="assets/js/demo.js"></script>


</html>
