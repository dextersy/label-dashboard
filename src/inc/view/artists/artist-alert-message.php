<? if ($_GET['action']) { ?>
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js"></script>
    <script type="text/javascript">
        setTimeout(function() {
            $('#alert-box').fadeOut('fast');
        }, 2500); // <-- time in milliseconds
    </script>

    
    <? if ($_GET['action'] == 'profile') { ?>
        <div class="alert alert-success" id="alert-box" role="alert">
            Profile successfully updated.
        </div>
    <? } else if ($_GET['action']=='invite') { 
        if($_GET['status']=='email_failed') { ?>
        <div class="alert alert-danger" id="alert-box" role="alert">
            Failed to send invite email. Please check your email address is correct or contact support.
        </div>
        <? } else { ?>
        <div class="alert alert-success" id="alert-box" role="alert">
            Team member invite email sent.
        </div>
        <? }
    } ?>
    </div>
<? } ?>