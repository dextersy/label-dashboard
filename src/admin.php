<?php 
include_once('./inc/controller/access_check.php'); 
include_once('./inc/util/Redirect.php');

if(!$isAdmin) {
    redirectTo("/index.php");
}

include_once('./inc/view/header.php');
?>

<?php include('./inc/view/after-body.php'); ?>
<div class="wrapper">
    <?php include_once('inc/view/sidebar.php'); ?>

    <div class="main-panel">
        <?php include_once('inc/view/navbar.php'); ?>
    
            <div class="container-fluid">
                <div class="row" style="padding:20px;">
                    <ul class="nav nav-pills">
                        <li class="active"><a data-toggle="tab" href="#brand">Brand Settings</a></li>
                        <li><a data-toggle="tab" href="#users"><i class="fa fa-user"></i> Users</a></li>
                        <li><a data-toggle="tab" href="#child-brands">Sublabels</a></li>
                        <li><a data-toggle="tab" href="#tools"><i class="fa fa-gear"></i> Tools</a></li>
                    </ul>
                    &nbsp;
                    <div class="tab-content">
                        <div id="brand" class="tab-pane fade in active">
                            <?php include_once('./inc/view/admin/brand-settings.php'); ?>                                
                        </div>
                        <div id="users" class="tab-pane fade">
                            <?php include_once('./inc/view/admin/users-list.php'); ?>                                
                        </div>
                        <div id="child-brands" class="tab-pane fade">
                            <?php include_once('./inc/view/admin/child-brands.php'); ?>                                
                        </div>
                        <div id="tools" class="tab-pane fade">
                            <?php include_once('./inc/view/admin/tools.php'); ?>                                
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
