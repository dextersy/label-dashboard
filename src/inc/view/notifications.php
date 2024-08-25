<?
include_once('inc/controller/access_check.php'); 
include_once('inc/controller/brand_check.php'); 
include_once('inc/controller/payment-controller.php'); 
include_once('inc/model/artist.php'); 

?>

<?php
    $error = "";
    $artist = new Artist;
    $artist->fromID($_SESSION['current_artist']);
    if(
        !isset($artist->name) || $artist->name == '' ||
        !isset($artist->facebook_handle) || $artist->facebook_handle == '' ||
        !isset($artist->bio) || $artist->bio == '' ||
        !isset($artist->profile_photo) || $artist->profile_photo == ''
    ) {
        $error .= "<li> You have some information missing in your profile. Click <a href=\"artist.php\">here</a> to update your profile.";
    }
    
    $paymentMethods = getPaymentMethodsForArtist($_SESSION['current_artist']);
    if (!$paymentMethods) { 
        $error .= "<li>You have not set any payment methods. Click <a href=\"financial.php#payments\">here</a> to update your payment settings.";
    }

    if (strlen($error) > 0) {
    ?>
<div class="row">
    <div class="col-md-12">
        <div class="alert alert-warning alert-dismissible fade in" role="alert">
        <b>Please check the following for your account.</b> <br> <?= $error; ?>
        <button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>
        </div>
    </div>
</div>
<?  } ?>