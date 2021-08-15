<?php include_once('./inc/view/header.php'); ?>
<body>

<div class="wrapper">
    <?php include_once('inc/view/sidebar.php'); ?>

    <div class="main-panel">
        <?php include_once('inc/view/navbar.php'); ?>
    
            <div class="container-fluid">
            <?php include_once('./inc/view/artist-selection.php'); ?>
            <?php include_once('./inc/view/artists/artist-alert-message.php'); ?>
                <div class="row" style="padding:20px;">
                    <ul class="nav nav-tabs">
                        <li class="active"><a data-toggle="tab" href="#profile">Profile</a></li>
                        <li><a data-toggle="tab" href="#releases">Releases</a></li>
                        <li><a data-toggle="tab" href="#team">Team</a></li>
                        <? if ($isAdmin) { ?> 
                        <li><a data-toggle="tab" href="#new-release"><i class="fa fa-lock" aria-hidden="true"></i> New Release</a></li>
                    <? } ?>
                    </ul>

                    <div class="tab-content">
                        <div id="profile" class="tab-pane fade in active">
                            <?php include_once('./inc/view/artists/artist-profile-tab.php'); ?>
                        </div>
                        <div id="releases" class="tab-pane fade">
                            <?php include_once('./inc/view/artists/artist-releases-tab.php'); ?>
                        </div>
                        <div id="team" class="tab-pane fade">
                            <?php include_once('./inc/view/artists/artist-team-tab.php'); ?>
                        </div>
                        <div id="new-release" class="tab-pane fade">
                            <?php include_once('./inc/view/artists/release-info.php'); ?>
                        </div>
                    </div>
                </div>
            </div>

    </div>
</div>


</body>

        <!--   Core JS Files   -->
        <script src="assets/js/jquery.3.2.1.min.js" type="text/javascript"></script>
	<script src="assets/js/bootstrap.min.js" type="text/javascript"></script>

</html>
