<?
    session_start();
    include_once('./inc/controller/access_check.php');
    include_once('./inc/controller/brand_check.php');
    include_once('./inc/controller/events-controller.php');
    include_once('./inc/controller/ticket-controller.php');

    if (!$isAdmin) {
        redirectTo('/index.php'); die();
    }

    define('EVENT_COUNT_LIMIT', 5);
    $events = getAllEvents($_SESSION['brand_id'], EVENT_COUNT_LIMIT);
?>
<div class="col-md-6">
<div class="card">
    <div class="card-header"><h5>Event Sales</h5></div>
    <div class="card-body">
        <div id="chartEventSales" class="ct-chart"></div>
    </div>
    <div class="card-footer text-right">
        <a href="events.php">Go to events <i class="fa fa-arrow-circle-o-right"></i></a>
    </div>
</div>
</div>

<link rel="stylesheet" href="//cdn.jsdelivr.net/chartist.js/latest/chartist.min.css">
<script src="//cdn.jsdelivr.net/chartist.js/latest/chartist.min.js"></script>

<script type="text/javascript">
new Chartist.Bar('#chartEventSales', {
  labels: [
<?
    foreach ($events as $event) {
        echo "'" . $event->title . "',";
    }
?>
    ],
  series: [
    [
<?
    foreach ($events as $event) {
        $net_sales = getNetSalesForEvent($event->id);
        echo ($net_sales != '' ? $net_sales : 0) . ',';
    }
?>
    ]
  ]
}, {
  seriesBarDistance: 5,
  reverseData: true,
  horizontalBars: true,
  axisY: {
    offset: 70
  }
});

</script>
