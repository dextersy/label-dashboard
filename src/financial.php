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
                        <li><a data-toggle="tab" href="#royalties">Royalties</a></li>
                        <li><a data-toggle="tab" href="#payments">Payments and Advances</a></li>
                    </ul>

                    <div class="tab-content">
                        <div id="summary" class="tab-pane fade in active">
                            <h3>Summary</h3>
                            
                        </div>
                        <div id="royalties" class="tab-pane fade">
                            <h3>Royalties</h3>
                            <div class="table-responsive">
                                <table class="table">
                                    <thead>
                                        <tr><th>Name</th>
                                        <th>Email address</th>
                                        <th>Artist Access</th>
                                        <th>Financial Access</th>
                                        <th>Status</th>
                                        <th>Actions</th></tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>Dexter</td>
                                            <td>sy.dexter@gmail.com</td>
                                            <td>Read</td>
                                            <td>Read</td>
                                            <td>Active</td>
                                            <td><i class="fas fa-pencil"></i><i class="fas fa-trash"></i></td>
                                        </tr>
                                        <tr><td>Debb</td><td>debbacebu@gmail.com</td><td>Read</td><td>Read</td><td><i class="fas fa-pencil"><i class="fas fa-trash"></i></td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div id="payments" class="tab-pane fade">
                            <?php include_once('./inc/view/financial/payments-view.php'); ?>
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
