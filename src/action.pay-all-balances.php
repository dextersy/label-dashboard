<?php
    require_once('./inc/model/payment.php');
    require_once('./inc/util/Redirect.php');
    require_once('./inc/controller/access_check.php');
    require_once('./inc/controller/brand_check.php');
    require_once('./inc/controller/payment-controller.php');
    require_once('./inc/controller/get-artist-list.php');
    require_once('./inc/controller/get-royalties.php');
    
    if(!$isAdmin) {
        redirectTo("/index.php");
        die();
    }

    $transfers_made = 0;
    $transfers_failed = 0;

    $artists = getAllArtists($_SESSION['brand_id']);
    if ($artists) {
        foreach ($artists as $artist) { 
            $totalRoyalties = getTotalRoyaltiesForArtist($artist->id);
            $totalPayments = getTotalPaymentsForArtist($artist->id);
            $totalBalance = $totalRoyalties - $totalPayments;
            if ($totalBalance > $artist->payout_point && !$artist->hold_payouts) {
                $paymentMethodsForArtist = getPaymentMethodsForArtist($artist->id);
                if(isset($paymentMethodsForArtist) && count($paymentMethodsForArtist) > 0) {
                    $success = true;
                    $payment = new Payment;
                    $payment->description = "Royalty payout";
                    $payment->amount = $totalBalance;
                    $payment->artist_id = $artist->id;
                    $payment->date_paid = date('Y-m-d');
                    $payment->payment_method_id = $paymentMethodsForArtist[0]->id;

                    $brand = new Brand;
                    $brand->fromID($_SESSION['brand_id']);

                    $success = makeAndSavePayment($payment, $brand);

                    if($success) {
                        $transfers_made++;
                    }
                    else {
                        $transfers_failed++;
                    }
                }
            }
        } 
    }

    redirectTo('/admin.php?action=payAll&status=OK&success=' . $transfers_made . '&failed=' . $transfers_failed . '#balance');
    
?>