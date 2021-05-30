<script src="https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js"></script>
<script type="text/javascript">
    setTimeout(function() {
        $('#alert-box').fadeOut('fast');
    }, 2500); // <-- time in milliseconds
</script>

<div class="alert alert-success" id="alert-box" role="alert">
<? if ($_GET['action'] == 'profile') { ?>
    Profile successfully updated.
<? } else if ($_GET['action']=='invite') { ?>
    Team member invite email sent.
<? } ?>
</div>
