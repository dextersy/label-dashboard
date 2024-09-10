<? 
    switch($_GET['status']) {
        case "OK": 
            $type = "alert-success";
            break;
        case "Failed": 
            $type = "alert-danger";
            break;
        default:
            break;
    }
    if ($_GET['action']=="update") {
        switch($_GET['status']) {
            case "OK":
                $msg = "Successfully updated brand settings.";
                break;
            case "Failed":
                $msg = "Failed to update brand settings.";
                break;
            default:
                break;
        }
    }
    if ($_GET['action']=="addDomain") {
        switch($_GET['status']) {
            case "OK":
                $msg = "Successfully added domain.";
                break;
            case "Failed":
                $msg = "Failed to add domain.";
                break;
            default:
                break;
        }
    }
    else if ($_GET['action'] == "deleteDomain") {
        switch($_GET['status']) {
            case "OK":
                $msg = "Successfully deleted domain.";
                break;
            case "Failed":
                $msg = "Failed to delete domain.";
                break;
            default:
                break;
        }
    }
    else if ($_GET['action'] == "VerifyDomain") {
        switch($_GET['status']) {
            case "OK":
                $msg = "Successfully verified domain.";
                break;
            case "Failed":
                $msg = "Failed to verify domain. Check your A Records.";
                break;
            default:
                break;
        }
    }

    if ($msg && $type) {
    ?>
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/2.1.1/jquery.min.js"></script>
    <script type="text/javascript">
        setTimeout(function() {
            $('#alert-box').fadeOut('fast');
        }, 2500); // <-- time in milliseconds
    </script>

    <div class="alert <?=$type;?>" id="alert-box" role="alert">
        <?=$msg;?>
    </div>    
<? 
    } 
?>