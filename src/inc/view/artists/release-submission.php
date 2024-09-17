<h3>Submit your release</h3>
<p>Submit your track information and files to us via Google Forms through the button below. <br>The form will open in a new tab. <br>After receiving your submission, we will create the release for you.</p>
<?
    require_once('./inc/model/brand.php');
    $brand = new Brand();
    $brand->fromID($_SESSION['brand_id']);
    if(isset($brand->release_submission_url) && strlen($brand->release_submission_url) > 0 ) {
?>
<p><a href="<?=$brand->release_submission_url;?>" target="_blank"><button class="btn btn-primary"><i class="fa fa-arrow-right"></i> Go to Form</button></p>
<?
    }
    else {
?>
<p style="color:red;"><em>No release submission URL set. Please contact your label representative.</em></p>
<?
    }
?>