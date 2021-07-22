<?php
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/payment.php');

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

        $i++;
    }
    return $paymentViewItems;
}

function getTotalPaymentsForArtist($artist_id){
    $sql = "SELECT SUM(`amount`) AS `total_payment` FROM `payment` " .
            "WHERE `artist_id` = ". $artist_id;
    $result = MySQLConnection::query($sql);
    if($result->num_rows > 0 && $row = $result->fetch_assoc()) {
        $totalPayments = $row['total_payment'];
    }
    return $totalPayments;
}

?>