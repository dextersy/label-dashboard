<?
    session_start();
    include_once('./inc/controller/access_check.php');
    include_once('./inc/controller/brand_check.php');
    include_once('./inc/controller/get-artist-list.php');

    if(!$isAdmin) {
        $artists = getArtistListForUser($_SESSION['logged_in_user']);
    }
    else {
        $artists = getAllArtists($_SESSION['brand_id']);
    }
?>
<div class="col-md-4">
<div class="card">
    <div class="card-header"><h5>Profile completion</h5></div>
    <div class="card-body">
        <div id="carouselExampleSlidesOnly" class="carousel slide" data-ride="carousel">
            <ol class="carousel-indicators">
                <li data-target="#carouselExampleIndicators" data-slide-to="0" class="active"></li>
                <li data-target="#carouselExampleIndicators" data-slide-to="1"></li>
                <li data-target="#carouselExampleIndicators" data-slide-to="2"></li>
            </ol>
            <div class="carousel-inner">
                <div class="carousel-item active">
                    <div id="chartProfileCompletion_1" class="ct-chart ct-minor-seventh"></div>
                    <h6>The profile for BAND NAME is 80% complete!</h6>                
                </div>
                <div class="carousel-item">
                    <div id="chartProfileCompletion_2" class="ct-chart ct-minor-seventh"></div>
                    <h6>The profile for BAND NAME is 60% complete!</h6>    
                </div>
                <div class="carousel-item">
                    <div id="chartProfileCompletion_3" class="ct-chart ct-minor-seventh"></div>
                    <h6>The profile for BAND NAME is 60% complete!</h6>    
                </div>
            </div>
            <a class="carousel-control-prev" href="#carouselExampleIndicators" role="button" data-slide="prev">
                <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                <span class="sr-only">Previous</span>
            </a>
            <a class="carousel-control-next" href="#carouselExampleIndicators" role="button" data-slide="next">
                <span class="carousel-control-next-icon" aria-hidden="true"></span>
                <span class="sr-only">Next</span>
            </a>
        </div>
        
    </div>
    <div class="card-footer text-right">
        <a href="events.php">Go to events <i class="fa fa-arrow-circle-o-right"></i></a>
    </div>
</div>
</div>

<link rel="stylesheet" href="//cdn.jsdelivr.net/chartist.js/latest/chartist.min.css">
<script src="//cdn.jsdelivr.net/chartist.js/latest/chartist.min.js"></script>

<script type="text/javascript">
new Chartist.Pie(
  '#chartProfileCompletion_1',
  {
    series: [80, 20]
  },
  {
    donut: true,
    donutWidth: 60,
    startAngle: 270,
    total: 200,
    showLabel: true
  }
);

new Chartist.Pie(
  '#chartProfileCompletion_2',
  {
    series: [60, 40]
  },
  {
    donut: true,
    donutWidth: 60,
    startAngle: 270,
    total: 200,
    showLabel: false
  }
);

new Chartist.Pie(
  '#chartProfileCompletion_3',
  {
    series: [80, 20]
  },
  {
    donut: true,
    donutWidth: 60,
    startAngle: 270,
    total: 200,
    showLabel: false
  }
);
</script>
