<?php
    include_once('./inc/controller/access_check.php');

    if($availableEvents[0]->id == NULL) {
        redirectTo('/newevent.php');
    }
?>
<?php include_once('./inc/view/header.php'); ?>
<body>
<?php include('./inc/view/after-body.php'); ?>
<div class="wrapper">
    <?php include_once('inc/view/sidebar.php'); ?>

    <div class="main-panel">
        <?php include_once('inc/view/navbar.php'); ?>
    
            <div class="container-fluid">
                <?php include_once('./inc/view/event-selection.php'); ?>
                <?php include_once('./inc/view/events/events-alert-message.php'); ?>
                <div class="row" style="padding:20px;">
                    <ul class="nav nav-tabs">
                        <li class="active"><a data-toggle="tab" href="#details"><i class="fa fa-info"></i>Details</a></li>
                        <li><a data-toggle="tab" href="#tickets"><i class="fa fa-ticket"></i>Tickets</a></li>
                        <li><a data-toggle="tab" href="#referrers"><i class="fa fa-user-plus" aria-hidden="true"></i>Referrals</a></li>
                    </ul>

                    <div class="tab-content">
                        <div id="details" class="tab-pane fade in active">
                            <?php include_once('./inc/view/events/event-info-tab.php'); ?>
                        </div>
                        <div id="tickets" class="tab-pane fade">
                            <?php include_once('./inc/view/events/ticket-list.php'); ?>
                        </div>
                        <div id="referrers" class="tab-pane fade">
                            <?php include_once('./inc/view/events/referrers-list.php'); ?>
                        </div>
                    </div>
                </div>
            </div>

    </div>
</div>


</body>

<? include_once('inc/view/footer.php'); ?>

</html>
