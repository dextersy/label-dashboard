<?php 
require_once('./inc/controller/access_check.php');

if(!$isAdmin) {
    redirectTo("/index.php");
    die();
}

include_once('./inc/view/header.php'); 
?>

<body>
<?php include('./inc/view/after-body.php'); ?>
<div class="wrapper">
    <?php include_once('inc/view/sidebar.php'); ?>

    <div class="main-panel">
        <?php include_once('inc/view/navbar.php'); ?>
    
            <div class="container-fluid">
            <?php 
                unset($_SESSION['current_artist']);
                include_once('./inc/view/artists/artist-profile-tab.php'); 
            ?>
            </div>

    </div>
</div>


</body>
        <!--   Core JS Files   -->
        <script src="assets/js/jquery.3.2.1.min.js" type="text/javascript"></script>
	<script src="assets/js/bootstrap.min.js" type="text/javascript"></script>


</html>
