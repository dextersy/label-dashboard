<?
    include_once ('./inc/controller/get-release-list.php');
    include_once ('./inc/controller/get-earnings.php');

    $yearNow = date('Y');
    $monthNow = date('m');

    if($monthNow > 9) {
        $quarters[3] = "Q4 " . $yearNow;
        $quarters[2] = "Q3 " . $yearNow;
        $quarters[1] = "Q2 " . $yearNow;
        $quarters[0] = "Q1 " . $yearNow;

        $startDate[3] = $yearNow . "-10-01";
        $endDate[3] = $yearNow . "-12-31";
        $startDate[2] = $yearNow . "-06-01";
        $endDate[2] = $yearNow . "-09-30";
        $startDate[1] = $yearNow . "-04-01";
        $endDate[1] = $yearNow . "-6-30";
        $startDate[0] = $yearNow . "-01-01";
        $endDate[0] = $yearNow . "-03-31";
    }
    else if($monthNow > 6) {
        $quarters[3] = "Q3 " . $yearNow;
        $quarters[2] = "Q2 " . $yearNow;
        $quarters[1] = "Q1 " . $yearNow;
        $quarters[0] = "Q4 " . $yearNow - 1;

        $startDate[3] = $yearNow . "-06-01";
        $endDate[3] = $yearNow . "-09-30";
        $startDate[2] = $yearNow . "-04-01";
        $endDate[2] = $yearNow . "-6-30";
        $startDate[1] = $yearNow . "-01-01";
        $endDate[1] = $yearNow . "-03-31";
        $startDate[0] = $yearNow-1 . "-10-01";
        $endDate[0] = $yearNow-1 . "-12-31";

    }
    else if($monthNow > 3) {
        $quarters[3] = "Q2 " . $yearNow;
        $quarters[2] = "Q1 " . $yearNow;
        $quarters[1] = "Q4 " . $yearNow - 1;
        $quarters[0] = "Q3 " . $yearNow - 1;

        $startDate[3] = $yearNow . "-04-01";
        $endDate[3] = $yearNow . "-6-30";
        $startDate[2] = $yearNow . "-01-01";
        $endDate[2] = $yearNow . "-03-31";
        $startDate[1] = $yearNow-1 . "-10-01";
        $endDate[1] = $yearNow-1 . "-12-31";
        $startDate[0] = $yearNow-1 . "-06-01";
        $endDate[0] = $yearNow-1 . "-09-30";
    }
    else {
        $quarters[3] = "Q1 " . $yearNow;
        $quarters[2] = "Q4 " . $yearNow - 1;
        $quarters[1] = "Q3 " . $yearNow - 1;
        $quarters[0] = "Q2 " . $yearNow - 1;

        $startDate[3] = $yearNow . "-01-01";
        $endDate[3] = $yearNow . "-03-31";
        $startDate[2] = $yearNow-1 . "-10-01";
        $endDate[2] = $yearNow-1 . "-12-31";
        $startDate[1] = $yearNow-1 . "-06-01";
        $endDate[1] = $yearNow-1 . "-09-30";
        $startDate[0] = $yearNow-1 . "-04-01";
        $endDate[0] = $yearNow-1 . "-6-30";
    }
    
    if(!$isAdmin) {
        $releases = getReleaseListForUser($_SESSION['logged_in_user']);
    }
    else {
        $releases = getReleaseListForAdmin($_SESSION['brand_id'], null);
    }
?>
<div class="col-md-6">
<div class="card">
    <div class="card-header"><h5>Earnings Per Quarter</h5></div>
    <div class="card-body">
        <div id="chart1"></div>
    </div>
    <div class="card-footer">
        <a href="financial.php#earnings">View all earnings</a>
    </div>
</div>
</div>

<!--  Chartist Plugin  -->
<link rel="stylesheet" href="//cdn.jsdelivr.net/chartist.js/latest/chartist.min.css">
<script src="//cdn.jsdelivr.net/chartist.js/latest/chartist.min.js"></script>
<script src="
https://cdn.jsdelivr.net/npm/chartist-plugin-legend@0.6.2/chartist-plugin-legend.min.js
"></script>

<script type="text/javascript">
new Chartist.Bar(
  '#chart1',
  {
    labels: ['<?=$quarters[0];?>', '<?=$quarters[1];?>', '<?=$quarters[2];?>', '<?=$quarters[3];?>'],
    series: [
<?
    foreach ($releases as $release) {
        $data = "";
        $total = 0;
        for ($i = 0; $i < 4; $i++) {
            $earning = getTotalEarningsForRelease($release->id, $startDate[$i], $endDate[$i]);
            $total += $earning;
            $data = $data . ($earning != '' ? $earning : '0');            
            if($i != 3) { $data = $data . ','; }
        }
        if($total > 0) {
            echo '{ "name": "' . $release->artist_name . " - " . $release->title . '", "data": [' . $data . '] },';
        }
   }
?>
    ]
  }, {
  stackBars: true,
  axisY: {
    labelInterpolationFnc: function(value) {
      return (value / 1000) + 'k';
    }
  },
  plugins: [
    Chartist.plugins.legend()
  ]
}).on('draw', function(data) {
  if(data.type === 'bar') {
    data.element.attr({
      style: 'stroke-width: 50px'
    });
  }
});

</script>