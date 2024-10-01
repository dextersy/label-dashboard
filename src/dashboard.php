<?php include_once('./inc/view/header.php'); ?>

<?php include('./inc/view/after-body.php'); ?>
<div class="wrapper">
    <?php include_once('inc/view/sidebar.php'); ?>

    <div class="main-panel">
        <?php include_once('inc/view/navbar.php'); ?>


        <div class="content">
            <div class="container-fluid">
            <h3 style="font-weight:normal;" class="text-secondary">Welcome to your dashboard, <strong><?=$_SESSION['logged_in_first_name'];?></strong>! ✨</h3>
            <hr>
                <div class="row">
                    <div class="col-md-4">
                        <?php include_once('./inc/view/dashboard/latest-albums-table.php'); ?>
                    </div>

                    <div class="col-md-4">
                        <?php include_once('./inc/view/dashboard/top-albums-table.php'); ?>
                    </div>

                    <div class="col-md-4">
                        <?php include_once('./inc/view/dashboard/balance-table.php'); ?>
                    </div>

                    <? if ($isAdmin) { ?>
                    <div class="col-md-6">
                        <?php include_once('./inc/view/dashboard/event-sales-chart.php'); ?>
                    </div>
                    <? } ?>
                    
                    <div class="col-md-6">
                        <?php //include_once('./inc/view/dashboard/top-albums-chart.php'); ?>
                    </div>
                    
                </div>
            </div>
        </div>


        

    </div>
</div>


</body>

<? include_once('inc/view/footer.php'); ?>


</html>
