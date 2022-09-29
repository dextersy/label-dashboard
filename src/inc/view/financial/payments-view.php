<?
    include_once("./inc/model/paymentmethod.php");
    include_once("./inc/controller/get-payments.php");
    session_start();
    $paymentViewItems = getPaymentsForArtist($_SESSION['current_artist']);
?>
<div class="row">
    <div class="col-md-6">
        <h3>Payments and Advances</h3>
        <div class="table-responsive">
            <table class="table">
                <thead>
                    <tr><th>Date Paid</th>
                    <th>Description</th>
                    <th style="text-align:right">Amount</th>
                </thead>
                <tbody>
                <? if ($paymentViewItems) {
                    foreach($paymentViewItems as $paymentViewItem) { ?>
                    <tr>
                        <td><?=$paymentViewItem->date_paid;?></td>
                        <td><?=$paymentViewItem->description;?></td>
                        <td align="right"><?=number_format($paymentViewItem->amount, 2);?></td>                
                    </tr>
                <?  }
                } else {
                ?>
                    No payments and advances yet.
                <? } ?>
                </tbody>
            </table>
        </div>
    </div>
    <div class="col-md-6">
        <h3>Payment Methods</h3>
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr><th>Type</th>
                        <th>Account Name</th>
                        <th>Account Number or Email</th>
                        <th></th>
                    </thead>
                    <tbody>
        <? 
            $paymentMethods = PaymentMethod::getPaymentMethodsForArtist($_SESSION['current_artist']);
            if ($paymentMethods) {
                foreach ($paymentMethods as $paymentMethod) { 
                ?>
                    <tr>
                        <td><?=$paymentMethod->type;?></td>
                        <td><?=$paymentMethod->account_name;?></td>
                        <td><?=$paymentMethod->account_number_or_email;?></td>
                        <td>
                            <?=$paymentMethod->is_default_for_artist?"<strong>Default</strong>":"[ Set as default ]";?>
                        </td>
                    </tr>
        <?          
                } 
            } else { ?>
            No payment methods set.
        <?  } ?>
                    </tbody>
                </table>
            </div>
            
            <h4>Add payment method</h4>
            <form action="action.add-payment-method.php" method="POST" enctype="multipart/form-data">
            <input type="hidden" name="artist_id" value="<?=$_SESSION['current_artist'];?>">
            <input type="radio" name="type" value="GCash">
            <label for="card">
                <img src="/assets/img/gcash.png" width="20">
                <span>GCash</span>
            </label>
            <input type="radio" name="type" value="BPI Transfer">
            <label for="cash">
                <img src="/assets/img/BPI-logo.jpg" height="20">
                <span>BPI Transfer</span>
            </label>       
            </input>
            <br>
            <label>Account name</label>
                <input type="text" class="form-control" name="account_name">
            <label>Account number or email address</label>
                <input type="text" class="form-control" name="account_number_or_email">
            <button type="submit" class="btn btn-default">Add</button>
            </form>

    </div>
</div>