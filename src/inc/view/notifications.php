<?
include_once('inc/controller/access_check.php'); 
include_once('inc/controller/brand_check.php'); 
include_once('inc/model/paymentmethod.php'); 
include_once('inc/model/artist.php'); 

?>

<?php
    $artist = new Artist;
    $artist->fromID($_SESSION['current_artist']);
    if(
        !isset($artist->name) || $artist->name == '' ||
        !isset($artist->facebook_handle) || $artist->facebook_handle == '' ||
        !isset($artist->bio) || $artist->bio == '' ||
        !isset($artist->profile_photo) || $artist->profile_photo == ''
    ) {
?>
<div class="row">
    <div class="col-md-12">
        <div class="alert alert-warning alert-dismissible fade in" role="alert">
        You have some information missing in your profile. Click <a href="artist.php">here</a> to update your profile.
        <button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>
        </div>
    </div>
</div>
<?php } ?>

<?php
    $paymentMethods = PaymentMethod::getPaymentMethodsForArtist($_SESSION['current_artist']);
    if (!$paymentMethods) { ?>
<div class="row">
    <div class="col-md-12">
        <div class="alert alert-warning alert-dismissible fade in" role="alert">
        You have not set any payment methods. Click <a href="financial.php#payments">here</a> to update your payment settings.
        <button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>
        </div>
    </div>
</div>
<? } ?>