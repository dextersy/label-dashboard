<?
    chdir("../..");
    include_once("./inc/config.php");
    include_once("./inc/model/ticket.php");
    include_once("./inc/model/event.php");
    include_once("./inc/model/user.php");
    include_once("./inc/util/Redirect.php");
    include_once("./inc/util/Mailer.php");
    require_once('./inc/controller/get_team_members.php');
    require_once('./inc/controller/users-controller.php');

    function sendAdminNotification($eventName, $ticket, $amount) {
        $i = 0;
        $admins = getAllAdmins($_SESSION['brand_id']);
        if ($admins != null) {
            foreach($admins as $recipient) {
                $emailAddresses[$i++] = $recipient->email_address;
            }
        }

        $referrerName = "";
        if (isset($ticket->referrer_id) && $ticket->referrer_id != '') {
            $referrer = new EventReferrer;
            $referrer->fromID($ticket->referrer_id);
            $referrerName = $referrer->name;
        }

		$subject = "New ticket order for ". $eventName;
		$body = "<h1>New ticket order</h1>";
        $body = $body . "<p>Name: " . $ticket->name . "<br>";
        $body = $body . "Email address: " . $ticket->email_address . "<br>";
        $body = $body . "Contact number: " . $ticket->contact_number . "<br>";
        $body = $body . "Ticket code: " . $ticket->ticket_code . "<br>";
        $body = $body . "Payment link ID: " . $ticket->payment_link_id . "<br>";
        $body = $body . "Amount: P" . number_format($amount, 2) . "<br>";
        $body = $body . "Referrer: " . $referrerName . "<br>";
        $body = $body . "No. of entries: " . $ticket->number_of_entries . "</p>";

		return sendEmail($emailAddresses, $subject, $body);
	}

    $event = new Event;
    $event->fromID($_POST['event_id']);
    $inputPIN = $_POST['pin'];
    if ($inputPIN == $event->verification_pin) {
        session_start();
        $_SESSION['verification_pin'] = $inputPIN;
        redirectTo('/public/tickets/verify.php?id=' . $_POST['event_id']);
    }
    else {
        redirectTo('/public/tickets/verify.php?err&id=' . $_POST['event_id']);
    }

?>