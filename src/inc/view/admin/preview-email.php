<?
    chdir(__DIR__ . '/../../..');
    include_once('./inc/model/emailattempt.php');
    include_once('./inc/controller/access_check.php');
    include_once('./inc/controller/brand_check.php');
    if(!$isAdmin) {
?>
Sorry, this tool requires admin access.
<?
        die();    
    }
    $emailAttempt = new EmailAttempt;
    if($emailAttempt->fromID($_GET['id']) && $emailAttempt->brand_id == $_SESSION['brand_id']) {
        echo $emailAttempt->body;
    } else {
?>
Sorry, the email does not exist.
<?
    }
?>