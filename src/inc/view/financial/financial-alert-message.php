<?
    $action = $_GET['action'];
    $status = $_GET['status'];


    if ($action == 'addPaymentMethod') {
        $msg = ($status == "OK") ? "Successfully added payment method." : "Failed to add payment method. Please try again or contact your administrator.";
    }
    else if ($action == 'payoutPoint') {
        $msg = ($status == "OK") ? "Successfully updated payout point." : "Failed to change payout point. Please try again or contact your administrator.";
    }    
    $alert_type = ($status == 'OK') ? 'alert-success' : 'alert-danger';


    if (isset($msg)) {
?>

    <!---- javascript here --->
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js"></script>
    <script type="text/javascript">
        setTimeout(function() {
            $('#alert-box').fadeOut('fast');
        }, 2500); // <-- time in milliseconds
    </script>
 
    <!---- HTML here --->
    <div class="alert <?=$alert_type;?>" id="alert-box" role="alert">
            <?=$msg;?>
    </div>
    
<? } ?>