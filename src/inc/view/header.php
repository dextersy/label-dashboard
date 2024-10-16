<? 
    include_once("./inc/controller/block_check.php");
    include_once("./inc/controller/access_check.php");
    include_once("./inc/controller/page-check.php");
?>
<!doctype html>
<html lang="en">
<head>
<?
    if(!$isAdmin) { ?>
    <!-- Google Tag Manager -->
        <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','GTM-KQHJ23P');</script>
    <!-- End Google Tag Manager -->
<? } ?>
	<meta charset="utf-8" />
	<link rel="icon" href="<?=$_SESSION['brand_favicon']!=''?$_SESSION['brand_favicon']:'../assets/img/default.ico';?>">
	<meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />

	<title><?=$title_text;?> | <?=$_SESSION['brand_name'];?></title>

	<meta content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0' name='viewport' />
    <meta name="viewport" content="width=device-width" />


    <!-- Bootstrap core CSS     -->
    <link href="assets/css/bootstrap.min.css?version=3" rel="stylesheet" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-select@1.13.14/dist/css/bootstrap-select.min.css">

    <!-- Animation library for notifications   -->
    <link href="assets/css/animate.min.css" rel="stylesheet"/>

    <!--  Light Bootstrap Table core CSS    -->
    <link href="assets/css/light-bootstrap-dashboard.css" rel="stylesheet"/>

    <!-- Custom CSS for artist dashboard -->
    <link href="assets/css/dashboard.css" rel="stylesheet"/>
    <link href="assets/css/loading.css" rel="stylesheet"/>

    <!--     Fonts and icons     -->
    <link href="https://maxcdn.bootstrapcdn.com/font-awesome/latest/css/font-awesome.min.css" rel="stylesheet">
    <link href='https://fonts.googleapis.com/css?family=Roboto:400,700,300' rel='stylesheet' type='text/css'>
    <link href="assets/css/pe-icon-7-stroke.css" rel="stylesheet" />

    <script type="text/javascript">
        window.onbeforeunload = function() {
            var loadingOverlay = document.getElementById('loadingOverlay');
            loadingOverlay.style.display = 'flex';
        };
    </script>

    <!-- FancyTable -->
    <script src="/assets/js/jquery.3.2.1.min.js"></script>
    <script src="/assets/js/fancyTable.min.js"></script>

</head>
<body>

<div id="loadingOverlay" class="loading-overlay" style="display:none;">
  <div class="loading"></div>
</div>