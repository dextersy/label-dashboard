<?php include_once('./inc/view/header.php'); ?>
<body>
<?php include('./inc/view/after-body.php'); ?>
<div class="wrapper">
    <?php include_once('inc/view/sidebar.php'); ?>

    <div class="main-panel">
        <?php include_once('inc/view/navbar.php'); ?>


        <div class="content">
            <div class="container-fluid">
                <div class="row">
                    <div class="col-md-4">
                        <div class="card">

                            <div class="header">
                                <h4 class="title">Your Albums</h4>
                            </div>
                            <div class="content">
                                <?php include_once('./inc/view/dashboard/album-table.php'); ?>
                            </div>
                        </div>
                    </div>

                    <div class="col-md-4">

                        <div class="card">
                            <div class="header">
                                <h4 class="title"><strong>Total Royalties</strong></h4>
                            </div>
                            <div class="content">
                                Your current total payments and advances is <i class="fa fa-info-circle" data-toggle="tooltip" data-placement="top" title="These are the royalties you've earned from all merch, digital, and streaming sales."></i><br>
                                <h5><strong>P<?=number_format($totalRoyalties, 2);?></strong></h5>
                                <p><a data-toggle="tab" href="#royalties">View royalty details</a></p>
                            </div>
                            
                        <? /*
                        <div class="header">
                                <h4 class="title">Your Royaltis</h4>
                                <p class="category">All products including Taxes</p>
                            </div>
                            <div class="content">
                            
                                <div id="chartActivity" class="ct-chart"></div>

                                <div class="footer">
                                    <div class="legend">
                                        <i class="fa fa-circle text-info"></i> Tesla Model S
                                        <i class="fa fa-circle text-danger"></i> BMW 5 Series
                                    </div>
                                    <hr>
                                    <div class="stats">
                                        <i class="fa fa-check"></i> Data information certified
                                    </div>
                                </div>
                            
                            </div>
                        */ ?>
                        </div>
                    </div>

                    <div class="col-md-4">

                        <div class="card">
                            <div class="header">
                                <h4 class="title"><strong>Total Payments</strong></h4>
                            </div>
                            <div class="content">
                                Your current total payments and advances is <i class="fa fa-info-circle" data-toggle="tooltip" data-placement="top" title="These are payments we've made to you in the form of royalty payouts, cash advances, and consigned merch sales."></i><br>
                                <h5><strong>P<?=number_format($totalPayments, 2);?></strong></h5>
                                <p><a data-toggle="tab" href="#payments">View payment details</a></p>
                            </div>
                        </div>
                    </div>

                    
                </div>
            </div>
        </div>


        

    </div>
</div>


</body>

<? include_once('inc/view/footer.php'); ?>


</html>
