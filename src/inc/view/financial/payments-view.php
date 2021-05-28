<?
    include("./inc/controller/get-payments.php");
    session_start();
    $paymentViewItems = getPaymentsForArtist($_SESSION['current_artist']);
?>
<h3>Payments and Advances</h3>
<div class="table-responsive">
    <table class="table">
        <thead>
            <tr><th>Date Paid</th>
            <th>Description</th>
            <th>Amount</th>
        </thead>
        <tbody>
        <? if ($paymentViewItems) {
            foreach($paymentViewItems as $paymentViewItem) { ?>
            <tr>
                <td><?=$paymentViewItem->date_paid;?></td>
                <td><?=$paymentViewItem->description;?></td>
                <td><?=$paymentViewItem->amount;?></td>                
            </tr>
        <?  }
        } else {
        ?>
            No payments and advances yet.
        <? } ?>
        </tbody>
    </table>
</div>