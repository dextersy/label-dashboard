<?php
    require_once('./inc/config.php');
    require_once('./inc/model/ticket.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/controller/get_tickets.php');
    require_once('./inc/util/Redirect.php');

    function isTicketPaid($payment_link_id) {
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
                "authorization: Basic " . PAYMONGO_SECRET_KEY
            ],
        ]);

        $response = curl_exec($curl);
        $err = curl_error($curl);

        curl_close($curl);

        if ($err) {
            return false;
        } else {
            $responseObject = json_decode($response);
            if($responseObject->data->attributes->status == 'paid') {
                return true;
            }
            else {
                return false;
            }
        }
    }

    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }

    $tickets = getTicketsForEvent($_SESSION['current_event']);
    foreach($tickets as $ticket) {
        
        //echo $ticket->id . " - " . $ticket->payment_link . "<br>";
        if (isTicketPaid($ticket->payment_link_id)) {
            $ticket->status = "Payment Confirmed";
            $ticket->save();
        }
    }
    redirectTo("/events.php?action=VerifyPayments&status=" . ($success ? "OK": "Failed"));
?>