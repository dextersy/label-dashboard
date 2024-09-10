<?php
    require_once('./inc/config.php');
    require_once('./inc/model/ticket.php');
    require_once('./inc/util/Redirect.php');
	require_once('./inc/controller/access_check.php');
	require_once('./inc/controller/brand_check.php');

	function cancelPaymentLink($link_id) {

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

	if (isset($_GET['ticket_id'])){
		$ticket = new Ticket;
		$ticket->fromID($_GET['ticket_id']);

        if(isset($ticket->payment_link_id)) {
    		cancelPaymentLink($ticket->payment_link_id);
        }
        
		$ticket->status = "Canceled";
		$ticket->save();
	}
	redirectTo('/events.php?action=canceled#tickets');
    
?>