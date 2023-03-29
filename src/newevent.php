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
                unset($_SESSION['current_event']);
                include_once('./inc/view/events/event-info-tab.php'); 
            ?>
            </div>

    </div>
</div>


</body>
<? include_once('inc/view/footer.php'); ?>

</html>
