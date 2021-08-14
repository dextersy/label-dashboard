<?php 
include_once('./inc/controller/access_check.php'); 
include_once('./inc/util/Redirect.php');

if(!$isAdmin) {
    redirectTo("/index.php");
}

include_once('./inc/view/header.php');
?>
<body>

<div class="wrapper">
    <?php include_once('inc/view/sidebar.php'); ?>

    <div class="main-panel">
        <?php include_once('inc/view/navbar.php'); ?>
    
            <div class="container-fluid">
                <div class="row" style="padding:20px;">
                    <ul class="nav nav-tabs">
                        <li><a data-toggle="tab" href="#bulk-add-earnings">Bulk Add Earnings</a></li>
                    </ul>

                    <div class="tab-content">
                        <div id="bulk-add-earnings" class="tab-pane fade in active">
                            <?php include_once('./inc/view/admin/bulk-add-earnings.php'); ?>                                
                        </div>
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
