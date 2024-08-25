<?php
require_once('./inc/config.php');
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/payment.php');
require_once('./inc/model/paymentmethod.php');

class PaymentViewItem {
    public $date_paid;
    public $description;
    public $amount;
}

function getPaymentsForArtist($artist_id, $start=0, $limit=-1){
    $sql = "SELECT `id` FROM `payment` " .
            "WHERE `artist_id` = ". $artist_id . " ".
            "ORDER BY `date_paid` DESC";
    if ($limit >= 0) {
        $sql = $sql . " LIMIT ". $start .", " . $limit;
    }
    $result = MySQLConnection::query($sql);
    $i = 0;
    
    while($result->num_rows > 0 && $row = $result->fetch_assoc()) {
        $payment = new Payment;
        $payment->fromID($row['id']);

        $paymentViewItems[$i] = new PaymentViewItem;
        $paymentViewItems[$i]->date_paid = $payment->date_paid;
        $paymentViewItems[$i]->description = $payment->description;
        $paymentViewItems[$i]->amount = $payment->amount;
        $paymentViewItems[$i]->paid_thru_type = $payment->paid_thru_type;
        $paymentViewItems[$i]->paid_thru_account_name = $payment->paid_thru_account_name;
        $paymentViewItems[$i]->paid_thru_account_number = $payment->paid_thru_account_number;

        $i++;
    }
    return $paymentViewItems;
}

function getTotalPaymentsForArtist($artist_id, $start_date = null, $end_date = null){
    $sql = "SELECT SUM(`amount`) AS `total_payment` FROM `payment` " .
            "WHERE `artist_id` = ". $artist_id;
    if($start_date != null && $end_date != null) {
        $sql = $sql . " AND `date_paid` BETWEEN '" . $start_date . "' AND '" . $end_date . "'";
    }
    $result = MySQLConnection::query($sql);
    if($result->num_rows > 0 && $row = $result->fetch_assoc()) {
        $totalPayments = $row['total_payment'];
    }
    return $totalPayments;
}

function getWalletBalance($brand_id) {
    $curl = curl_init();

    curl_setopt_array($curl, [
    CURLOPT_URL => "https://api.paymongo.com/v1/wallets/" . PAYMONGO_WALLET_ID, // @TODO Replace this with database entry from brand
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

    if($err) {
        return -1;
    }
    else {
        $wallet = json_decode($response);
        return $wallet->data->attributes->available_balance / 100;
    }
}

function getPaymentMethodsForArtist($artist_id) {
    $sql = "SELECT * FROM `payment_method` WHERE `artist_id` = '" . $artist_id . "'";
    $result = MySQLConnection::query($sql);
    if ($result->num_rows < 1) {
        return null;
    }

    $i = 0;
    while($row = $result->fetch_assoc()) {
        $paymentMethods[$i++] = new PaymentMethod(
            $row['id'],
            $row['artist_id'],
            $row['type'],
            $row['account_name'],
            $row['account_number_or_email'],
            $row['is_default_for_artist']
        );
    }
    return $paymentMethods;
}

?>