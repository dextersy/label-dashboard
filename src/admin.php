<?php 
include_once('./inc/controller/access_check.php'); 
include_once('./inc/util/Redirect.php');

if(!$isAdmin) {
    redirectTo("/index.php");
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
                <div class="row" style="padding:20px;">
                    <ul class="nav nav-tabs">
                        <li class="active"><a data-toggle="tab" href="#brand">Brand Settings</a></li>
                        <li><a data-toggle="tab" href="#summary">Summary View</a></li>
                        <li><a data-toggle="tab" href="#balance">Balance Summary</a></li>
                        <li><a data-toggle="tab" href="#bulk-add-earnings">Bulk Add Earnings</a></li>
                    </ul>

                    <div class="tab-content">
                        <div id="brand" class="tab-pane fade in active">
                            <?php include_once('./inc/view/admin/brand-settings.php'); ?>                                
                        </div>
                        <div id="summary" class="tab-pane fade">
                            <?php include_once('./inc/view/admin/admin-summary-view.php'); ?>                                
                        </div>
                        <div id="balance" class="tab-pane fade">
                            <?php include_once('./inc/view/admin/balance-summary.php'); ?>                                
                        </div>
                        <div id="bulk-add-earnings" class="tab-pane fade">
                            <?php include_once('./inc/view/admin/bulk-add-earnings.php'); ?>                                
                        </div>
                    </div>
                </div>
            </div>
        </nav>

    </div>
</div>


</body>

<? include_once('inc/view/footer.php'); ?>

</html>
