<?php include_once('./inc/view/header.php'); ?>

<?php include('./inc/view/after-body.php'); ?>
<div class="wrapper">
    <?php include_once('inc/view/sidebar.php'); ?>
    
    <div class="main-panel">
        <?php include_once('inc/view/navbar.php'); ?>
        
            <div class="container-fluid">
            <?php include_once('./inc/view/artist-selection.php'); ?>
            <?php include_once('./inc/view/notifications.php'); ?>
            <?php include_once('./inc/view/financial/financial-alert-message.php'); ?>
                <div class="row" style="padding:20px;">
                    <ul class="nav nav-pills">
                        <li class="active"><a data-toggle="tab" href="#summary"><i class="fa fa-info"></i> Summary</a></li>
                        <li><a data-toggle="tab" href="#documents"><i class="fa fa-file"></i> Documents</a></li>
                        <li><a data-toggle="tab" href="#earnings"><i class="fa fa-dollar"></i> Earnings</a></li>
                        <li><a data-toggle="tab" href="#royalties"><i class="fa fa-star"></i> Royalties</a></li>
                        <li><a data-toggle="tab" href="#payments"><i class="fa fa-credit-card"></i> Payments and Advances</a></li>
                        <li><a data-toggle="tab" href="#release"><i class="fa fa-play"></i> Release Information</a></li>
                    <? if ($isAdmin) { ?> 
                        <li><a data-toggle="tab" href="#new-royalty"><i class="fa fa-lock" aria-hidden="true"></i> New Royalty</a></li>
                        <li><a data-toggle="tab" href="#new-payment"><i class="fa fa-lock" aria-hidden="true"></i> New Payment</a></li>
                        <li><a data-toggle="tab" href="#new-earning"><i class="fa fa-lock" aria-hidden="true"></i> New Earning</a></li>
                    <? } ?>
                    </ul>

                    <div class="tab-content">
                        <div id="summary" class="tab-pane fade in active">
                            <?php include_once('./inc/view/financial/summary-view.php'); ?>                                
                        </div>
                        <div id="documents" class="tab-pane fade">
                            <?php include_once('./inc/view/financial/documents-view.php'); ?>
                        </div>
                        <div id="earnings" class="tab-pane fade">
                            <?php include_once('./inc/view/financial/earnings-view.php'); ?>
                        </div>
                        <div id="royalties" class="tab-pane fade">
                            <?php include_once('./inc/view/financial/royalties-view.php'); ?>
                        </div>
                        <div id="payments" class="tab-pane fade">
                            <?php include_once('./inc/view/financial/payments-view.php'); ?>
                        </div>
                        <div id="release" class="tab-pane fade">
                            <?php include_once('./inc/view/financial/release-view.php'); ?>
                        </div>

                    <? if ($isAdmin) { ?>
                        <div id="new-royalty" class="tab-pane fade">
                            <?php include_once('./inc/view/financial/new-royalty.php'); ?>
                        </div>
                        <div id="new-payment" class="tab-pane fade">
                            <?php include_once('./inc/view/financial/new-payment.php'); ?>
                        </div>
                        <div id="new-earning" class="tab-pane fade">
                            <?php include_once('./inc/view/financial/new-earning.php'); ?>
                        </div>
                    <? } ?>
                    </div>
                </div>
            </div>
        </nav>

    </div>
</div>


</body>
<? include_once('inc/view/footer.php'); ?>


</html>
