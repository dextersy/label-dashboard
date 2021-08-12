<?php include_once('./inc/view/header.php'); ?>
<body>

<div class="wrapper">
    <?php include_once('inc/view/sidebar.php'); ?>

    <div class="main-panel">
        <?php include_once('inc/view/navbar.php'); ?>
    
            <div class="container-fluid">
            <?php include_once('./inc/view/artist-selection.php'); ?>
                <div class="row" style="padding:20px;">
                    <ul class="nav nav-tabs">
                        <li class="active"><a data-toggle="tab" href="#summary">Summary</a></li>
                        <li><a data-toggle="tab" href="#earnings">Earnings</a></li>
                        <li><a data-toggle="tab" href="#royalties">Royalties</a></li>
                        <li><a data-toggle="tab" href="#payments">Payments and Advances</a></li>
                        <li><a data-toggle="tab" href="#recuperable_expenses">Recuperable Expenses</a></li>
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
                        <div id="earnings" class="tab-pane fade">
                            <?php include_once('./inc/view/financial/earnings-view.php'); ?>
                        </div>
                        <div id="royalties" class="tab-pane fade">
                            <?php include_once('./inc/view/financial/royalties-view.php'); ?>
                        </div>
                        <div id="payments" class="tab-pane fade">
                            <?php include_once('./inc/view/financial/payments-view.php'); ?>
                        </div>
                        <div id="recuperable_expenses" class="tab-pane fade">
                            <?php include_once('./inc/view/financial/recuperable-expense-view.php'); ?>
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

        <!--   Core JS Files   -->
    <script src="assets/js/jquery.3.2.1.min.js" type="text/javascript"></script>
	<script src="assets/js/bootstrap.min.js" type="text/javascript"></script>

	<!--  Charts Plugin -->
	<script src="assets/js/chartist.min.js"></script>

    <!--  Notifications Plugin    -->
    <script src="assets/js/bootstrap-notify.js"></script>

    <!--  Google Maps Plugin    -->
    <script type="text/javascript" src="https://maps.googleapis.com/maps/api/js?key=YOUR_KEY_HERE"></script>

    <!-- Light Bootstrap Table Core javascript and methods for Demo purpose -->
	<script src="assets/js/light-bootstrap-dashboard.js?v=1.4.0"></script>

	<!-- Light Bootstrap Table DEMO methods, don't include it in your project! -->
	<script src="assets/js/demo.js"></script>

    <script>
        $().ready(function(){
            demo.initGoogleMaps();
        });
    </script>

</html>
