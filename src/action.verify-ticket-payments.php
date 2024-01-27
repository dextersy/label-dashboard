<?php
    require_once('./inc/config.php');
    require_once('./inc/model/ticket.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/controller/get_tickets.php');
    require_once('./inc/util/Redirect.php');

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
                "authorization: Basic " . PAYMONGO_SECRET_KEY
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

    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }

    $tickets = getTicketsForEvent($_SESSION['current_event']);
    foreach($tickets as $ticket) {
        
        //echo $ticket->id . " - " . $ticket->payment_link . "<br>";
        if ($ticket->status == 'New' ) {
            $info = getPaymentInformation($ticket->payment_link_id);
            if ($info != null) {
                $ticket->payment_processing_fee = $info->payment_processing_fees;
                $ticket->status = "Payment Confirmed";
                $ticket->save();
            }
        }
    }
    redirectTo("/events.php?action=VerifyPayments&status=" . ($success ? "OK": "Failed"));
?>