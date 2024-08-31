<?
    $action = $_GET['action'];
    $status = $_GET['status'];


    if ($action == 'profile') {
        $msg = ($status == "OK") ? "Successfully updated artist profile." : "Something went wrong. Please try updating your profile again.";
    }
    else if ($action == 'invite') {
        $msg = ($status == "OK") ? "Team invites sent successfully." : "Something went wrong. Please try again or contact your administrator.";
    }
    else if ($action == 'RemoveMember') {
        $msg = ($status == "OK") ? "Successfully removed team member." : "Something went wrong. Please try again or contact your administrator.";
    }
    else if ($action == 'uploadPhoto') {
        $msg = ($status == "OK") ? "Successfully uploaded new photos. You may now add captions." : "Something went wrong. Please try again or contact your administrator.";
    }
    else if ($action == 'updatePhotoCaption') {
        $msg = ($status == "OK") ? "Captions have been saved." : "Something went wrong. Please try again or contact your administrator.";
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