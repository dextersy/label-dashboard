<?
include_once('inc/controller/access_check.php'); 
include_once('inc/controller/brand_check.php'); 

?>
<div class="sidebar" data-color="<?=$_SESSION['brand_color'];?>" data-image="assets/img/sidebar-5.jpg">

    <!--

        Tip 1: you can change the color of the sidebar using: data-color="blue | azure | green | orange | red | purple"
        Tip 2: you can also add an image using data-image tag

    -->

    	<div class="sidebar-wrapper">
            <div class="logo">
                <a href="<?=$_SESSION['brand_website'];?>" class="simple-text">
                    <img src="<?=$_SESSION['brand_logo'];?>" width="100">
                </a>
            </div>

            <?php include_once("./inc/controller/page-check.php"); ?>
            <ul class="nav">
                <li<? if($dashboard_active) { ?> class="active"<? } ?>>
                    <a href="dashboard.php">
                        <i class="pe-7s-graph"></i>
                        <p>Dashboard</p>
                    </a>
                </li>
                <li<? if($artist_active) { ?> class="active"<? } ?>>
                    <a href="artist.php">
                        <i class="pe-7s-headphones"></i>
                        <p>Artist</p>
                    </a>
                </li>
                <li<? if($financial_active) { ?> class="active"<? } ?>>
                    <a href="financial.php">
                        <i class="pe-7s-note2"></i>
                        <p>Financial</p>
                    </a>
                </li>
                <? if ($isAdmin) { ?>
                    <li<? if($events_active) { ?> class="active"<? } ?>>
                        <a href="events.php">
                            <i class="pe-7s-date"></i>
                            <p>Events</p>
                        </a>
                    </li>
                
                <? } ?>
                <? if ($isAdmin) { ?>
                    <li<? if($admin_active) { ?> class="active"<? } ?>>
                        <a href="admin.php">
                            <i class="pe-7s-lock"></i>
                            <p>Admin</p>
                        </a>
                    </li>
                
                <? } ?>
                
            </ul>
    	</div>
    </div>