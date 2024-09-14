<?php
    include_once('./inc/controller/block_check.php');
    include_once('./inc/controller/brand_check.php');
?>
<html>
<header>
  <title><?=$_SESSION['brand_name'];?> Dashboard Beta</title>
  <meta content='width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0' name='viewport' />
    <meta name="viewport" content="width=device-width" />
  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','GTM-KQHJ23P');</script>
  <!-- End Google Tag Manager -->
  <link href="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" rel="stylesheet" id="bootstrap-css">
  <link href="assets/css/login.css?version=1.3" rel="stylesheet">
  <link href="assets/css/loading.css" rel="stylesheet">
  <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/font-awesome/latest/css/font-awesome.min.css" />
  <script src="//maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js"></script>
  <script src="//cdnjs.cloudflare.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>

  <script type="text/javascript">
    window.onbeforeunload = function() {
        var loadingOverlay = document.getElementById('loadingOverlay');
        loadingOverlay.style.display = 'flex';
    };
  </script>
</header>

<body>
<?php
    include_once('./inc/view/after-body.php');
?>
<div id="loadingOverlay" class="loading-overlay" style="display:none;">
  <div class="loading"></div>
</div>