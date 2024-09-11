<?php 
require_once('./inc/controller/access_check.php');

if(!$isAdmin) {
    redirectTo("/index.php");
    die();
}

include_once('./inc/view/header.php'); 
?>


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
<? include_once('inc/view/footer.php'); ?>

</html>
