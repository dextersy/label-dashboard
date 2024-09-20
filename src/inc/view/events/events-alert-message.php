<? if ($_GET['action']) { ?>
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js"></script>
    <script type="text/javascript">
        setTimeout(function() {
            $('#alert-box').fadeOut('fast');
        }, 2500); // <-- time in milliseconds
    </script>

    
    <? if ($_GET['action']=='send') { 
        if($_GET['status']=='email_failed') { ?>
        <div class="alert alert-danger" id="alert-box" role="alert">
            Failed to send ticket. Please verify the ticket address and try again..
        </div>
        <? } else { ?>
        <div class="alert alert-success" id="alert-box" role="alert">
            Ticket successfully sent.
        </div>
        <? }
    } else if ($_GET['action']=='paid') { ?>
    <div class="alert alert-success" id="alert-box" role="alert">
            Ticket mark as paid.
        </div>
    <? 
    } else if ($_GET['action']=='cancelTicket') { ?>
        <div class="alert <?=$_GET['result']=='OK'?'alert-success':'alert-danger';?>" id="alert-box" role="alert">
            <?=$_GET['result']=='OK'?'Successfully canceled ' . $_GET['count']. ' ticket(s).':'Something went wrong. Please try again';?>
        </div>
    <? 
    }
    ?>
    </div>
<? } ?>