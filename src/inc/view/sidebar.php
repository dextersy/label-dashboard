<div class="sidebar" data-color="purple" data-image="assets/img/sidebar-5.jpg">

    <!--

        Tip 1: you can change the color of the sidebar using: data-color="blue | azure | green | orange | red | purple"
        Tip 2: you can also add an image using data-image tag

    -->

    	<div class="sidebar-wrapper">
            <div class="logo">
                <a href="http://www.melt-records.com" class="simple-text">
                    <img src="assets/img/Melt%20Records-logo-WHITE.png" width="200">
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
                
            </ul>
    	</div>
    </div>