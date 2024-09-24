<?  
    include_once('./inc/model/ticket.php');
    include_once('./inc/model/event.php');
	require_once('./inc/util/Mailer.php');
    require_once('./vendor/phpqrcode.php');

    function getTicketsForEvent($event){
        $sql = "SELECT * FROM `ticket` ".
            "WHERE `event_id` = '" . $event . "' AND `status` = 'Ticket sent.'";
        $result = MySQLConnection::query($sql);
        if ($result->num_rows < 1) {
            return null;
        }
    
        $i = 0;
        while($row = $result->fetch_assoc()) {
            $tickets[$i++] = new Ticket(
                $row['id'],
                $row['event_id'],
                $row['name'],
                $row['email_address'],
                $row['contact_number'],
                $row['number_of_entries'],
                $row['number_of_claimed_entries'],
                $row['ticket_code'],
                $row['status'],
                $row['payment_link'],
                $row['payment_link_id'],
                $row['price_per_ticket'],
                $row['payment_processing_fee'],
                $row['referrer_id'],
                $row['order_timestamp'],
                $row['checkout_key']
            );
        }
        return $tickets;
    }

    function getPendingTicketsForEvent($event){
        $sql = "SELECT * FROM `ticket` ".
            "WHERE `event_id` = '" . $event . "' AND `status` <> 'Ticket sent.' AND `status` <> 'Canceled'";
        $result = MySQLConnection::query($sql);
        if ($result->num_rows < 1) {
            return null;
        }
    
        $i = 0;
        while($row = $result->fetch_assoc()) {
            $tickets[$i++] = new Ticket(
                $row['id'],
                $row['event_id'],
                $row['name'],
                $row['email_address'],
                $row['contact_number'],
                $row['number_of_entries'],
                $row['number_of_claimed_entries'],
                $row['ticket_code'],
                $row['status'],
                $row['payment_link'],
                $row['payment_link_id'],
                $row['price_per_ticket'],
                $row['payment_processing_fee'],
                $row['referrer_id'],
                $row['order_timestamp'],
                $row['checkout_key']
            );
        }
        return $tickets;
    }

    class PaymentInfo {
        public $payment_processing_fees;
        public $status;
    }
    function getPaymentInformation($payment_link_id) {
        if(!isset($payment_link_id)) return false;
        $curl = curl_init();

        curl_setopt_array($curl, [
            CURLOPT_URL => "https://api.paymongo.com/v1/links/" . $payment_link_id,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_ENCODING => "",
            CURLOPT_MAXREDIRS => 10,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
            CURLOPT_CUSTOMREQUEST => "GET",
            CURLOPT_HTTPHEADER => [
                "accept: application/json",
                "authorization: Basic " . base64_encode(PAYMONGO_SECRET_KEY)
            ],
        ]);

        $response = curl_exec($curl);
        $err = curl_error($curl);

        curl_close($curl);

        if ($err) {
            return null;
        } else {
            $responseObject = json_decode($response);
            
            if($responseObject->data->attributes->status == 'paid') {
                $totalProcessingFee = 0;
                $payments = $responseObject->data->attributes->payments;
                foreach ($payments as $payment) {
                    $totalProcessingFee += ($payment->data->attributes->amount - $payment->data->attributes->net_amount) / 100;
                }
                $info = new PaymentInfo();
                $info->payment_processing_fees = $totalProcessingFee;
                $info->status = 'paid';
                return $info;
            }
            else {
                return null;
            }
        }
    }

    function updateTicketPaymentStatus($id, $processing_fee = null) {
        $ticket = new Ticket;
        if (!$ticket->fromID($id)) {
            return false;
        }
        if ($ticket->status == 'New' ) {
            if(!isset($processing_fee) && isset($ticket->payment_link_id)) {
                // @TODO This assumes that the only scenario where processing fee is not passed 
                // is from payment links verification
                $info = getPaymentInformation($ticket->payment_link_id);
                if ($info != null) {
                    $processing_fee = $info->payment_processing_fees;
                }
            }
            if(isset($processing_fee)) {
                $ticket->payment_processing_fee = $processing_fee;
                $ticket->status = "Payment Confirmed";
                $ticket->save();
                return true;
            }
        }
        return false;
    }


    // Sending tickets
    $GLOBALS['debugOutput'] = [];

    function __generateQRCode($ticketCode) {
        $path = "tmp/qrcode/" . $ticketCode . ".png";
        QRcode::png($ticketCode, $path);
        return "https://" . $_SERVER['SERVER_NAME'] . '/' . $path;
    }
    function __sendTicketToEmail($emailAddress, $eventName, $name, $ticketCode, $qrCode, $numberOfEntries, $eventDate, $rsvpLink) {
		$subject = "Here's your ticket to ". $eventName . "!";
		$emailAddresses[0] = $emailAddress;
		return sendEmail($emailAddresses, $subject, __generateEmailFromTemplate($eventName, $name, $ticketCode, $qrCode, $numberOfEntries, $rsvpLink));
	}

    function __generateEmailFromTemplate($eventName, $name, $ticketCode, $qrCode, $numberOfEntries, $rsvpLink) {
		define ('TEMPLATE_LOCATION', 'assets/templates/event_ticket_email.html', false);
		$file = fopen(TEMPLATE_LOCATION, 'r');
		$msg = fread($file, filesize(TEMPLATE_LOCATION));
		fclose($file);

        $msg = str_replace("%BRAND_NAME%", $_SESSION['brand_name'], $msg);
		$msg = str_replace('%EVENT_NAME%', $eventName, $msg);
		$msg = str_replace('%NAME%', $name, $msg);
        $msg = str_replace('%QR_CODE%', $qrCode, $msg);
		$msg = str_replace('%TICKET_CODE%', $ticketCode, $msg);
		$msg = str_replace('%NO_OF_ENTRIES%', $numberOfEntries, $msg);
		$msg = str_replace('%RSVP_LINK%', $rsvpLink, $msg);
		
		return $msg;
	}

    function sendTicket($id) {
        $ticket = new Ticket;
		$ticket->fromID($id);
		$event = new Event;
		$event->fromID($ticket->event_id);

        $qrCode = __generateQRCode($ticket->ticket_code);
        if($qrCode != null) {
            $result = __sendTicketToEmail(
                $ticket->email_address,
                $event->title,
                $ticket->name,
                $ticket->ticket_code,
                $qrCode,
                $ticket->number_of_entries,
                $event->date_and_time,
                $event->rsvp_link
            );
            if ($result) {
                $ticket->status = "Ticket sent.";
                $ticket->save();
            }
        }
        else {
            $result = false;
        }
        return $result;
    }

    function __cancelPaymentLink($link_id) {
        $curl = curl_init();
        curl_setopt_array($curl, [
                CURLOPT_URL => "https://api.paymongo.com/v1/links/" . $link_id . "/archive",
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_ENCODING => "",
                CURLOPT_MAXREDIRS => 10,
                CURLOPT_TIMEOUT => 30,
                CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
                CURLOPT_CUSTOMREQUEST => "POST",
                CURLOPT_HTTPHEADER => [
                    "accept: application/json",
                    "authorization: Basic " . base64_encode(PAYMONGO_SECRET_KEY),
                    "content-type: application/json"
                ],
            ]);

        $response = curl_exec($curl);
        $err = curl_error($curl);

        curl_close($curl);

        if ($err) {
            return $err;
        } else {
            return json_decode($response, false);
        }
    }

    function archiveTicket($id) {
        $ticket = new Ticket;
        $ticket->fromID($id);
    
        if(isset($ticket->payment_link_id)) {
            __cancelPaymentLink($ticket->payment_link_id);
        }
        
        $ticket->status = "Canceled";
        return $ticket->save();
    }
?>