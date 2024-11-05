<?
    include_once("./inc/model/paymentmethod.php");
    include_once("./inc/model/artist.php");
    include_once("./inc/controller/payment-controller.php");
    session_start();
    $paymentViewItems = getPaymentsForArtist($_SESSION['current_artist']);

    $artist = new Artist;
    $artist->fromID($_SESSION['current_artist']);

    $banks = getSupportedBanksForTransfer();
?>
&nbsp;
<? if($artist->hold_payouts) { ?>
    <div class="alert alert-warning">
        <strong><i class="fa fa-pause-circle-o"></i> Automatic payouts are currently paused for this artist.</strong><br>
        <small>If you're not sure why, please contact your label representative.</small>
    </div>

<? } ?>

<div class="row">
    <div class="col-md-6">
        <div class="card">
            <div class="card-header">
            <h5><strong>Payments and Advances</strong> <? if ($isAdmin) { ?><a data-toggle="tab" href="#new-payment"><i class="fa fa-plus"></i></a><? } ?></h5>
            </div>
            <div class="card-body">
                <? if ($paymentViewItems) { ?>
                    <div class="table-responsive">
                    <table class="table" id="tblPayments">
                    <thead>
                        <tr><th>Date Paid</th>
                        <th>Description</th>
                        <th>Paid Through</th>
                        <th style="text-align:right" data-sortas="numeric">Amount</th>
                        <th style="text-align:right" data-sortas="numeric">Fee</th>
                    </thead>
                    <tbody>
                <?php
                    foreach($paymentViewItems as $paymentViewItem) { 
                        if($paymentViewItem->paid_thru_type != '') {
                            $paymentMethod = $paymentViewItem->paid_thru_type . ' - ' . $paymentViewItem->paid_thru_account_name . ' - ' . $paymentViewItem->paid_thru_account_number;
                        }
                        else {
                            $paymentMethod = "<span class=\"text-muted\"><em>Non-cash / adjustment</em></span>";
                        }
                ?>
                    <tr>
                        <td><?=$paymentViewItem->date_paid;?></td>
                        <td><?=$paymentViewItem->description;?></td>
                        <td><?=$paymentMethod;?></td>
                        <td align="right"><?=number_format($paymentViewItem->amount, 2);?></td>   
                        <td align="right"><?=number_format($paymentViewItem->payment_processing_fee, 2);?></td>               
                    </tr>
                <?  } ?>

                </tbody>
                </table>

                </div>
                <?
                } else {
                ?>
                No payments and advances yet.
                <? } ?>
            </div>                  
        </div>
        <div class="card">
        <div class="card-header">
        <h5><strong>Payout point</strong></h5>
        </div>
        <div class="card-body">
            When your balance reaches this amount, you will receive a payout through your default payment method. 

        <form action="action.update-payout-settings.php" method="POST" enctype="multipart/form-data">
        <input type="hidden" name="id" value="<?=$artist->id;?>">
        <? if($isAdmin) { ?>
            <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="switchHoldPayout" name="hold_payouts" value="1" <?=$artist->hold_payouts ? "checked": "";?>>
                <label class="form-check-label" for="switchHoldPayout">Pause automatic payouts for this artist</label>
            </div>
        <? } ?>
        <div class="input-group">
            <div class="input-group-addon">
                ₱
            </div>
            <input type="number" min="1000" step="1" class="form-control text-right" name="payout_point" value="<?=$artist->payout_point;?>" required>
            <div class="input-group-btn">
                <button type="submit" class="btn btn-primary">Save</button>
            </div>
        </div>
        </form>

        <div class="alert alert-info">
        <i class="fa fa-info-circle"></i> Minimum value is P1,000. Charge of P10.00 is deducted from each payout.
        </div>
        </div>
        </div>
    </div>
    <div class="col-md-6">

    <div class="card">
    <div class="card-header">
        <h5><strong>Payment Methods</strong></h5>
    </div>
        <div class="card-body">
            
        <? 
            $paymentMethods = getPaymentMethodsForArtist($_SESSION['current_artist']);
            if ($paymentMethods) {
        ?>
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr><th>Bank</th>
                        <th>Account Name</th>
                        <th>Account Number</th>
                        <th></th>
                    </thead>
                    <tbody>
        <?php
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
                } ?>
                </tbody>
                </table>
            </div>
            <?php
            } else { ?>
            <i class="fa fa-warning"></i> No payment methods set. Please add your bank information below.
        <?  } ?>
                    
            </div>
            </div>
            <div class="card">
                <div class="card-header">
            <h5>Add bank details</h5>
            </div>
            <div class="card-body">
            
            <form action="action.add-payment-method.php" method="POST" enctype="multipart/form-data">
            <input type="hidden" name="artist_id" value="<?=$_SESSION['current_artist'];?>">
            <label>Bank name</label>
            <select class="form-control" name="bank_selection" id="type" required="true">
        <?php
            foreach($banks as $bank) {
        ?>
                <option value="<?=$bank->bank_code;?>,<?=$bank->bank_name;?>"><?=$bank->bank_name;?></option>
        <?php
            }
        ?>  
            </select>
            <label>Account name</label>
                <input type="text" class="form-control" name="account_name" required>
            <label>Account number</label>
                <input type="text" class="form-control" name="account_number_or_email" required>
            <div class="alert alert-info">
                <i class="fa fa-warning"></i> Before submitting, please make sure the details are correct. Payments sent to wrong accounts may not be recoverable.
            </div>
        </div>
        <div class="card-footer">
            <button type="submit" class="btn btn-primary btn-block">Add Payment Method</button>
            </form>
        </div>
        </div>
    </div>
</div>

<script type="text/javascript" src="/assets/js/custom-sort-for-fancyTable.js"></script>
<script type="text/javascript">
$("#tblPayments").fancyTable({
  sortColumn:0, // column number for initial sorting
  sortOrder: 'descending', // 'desc', 'descending', 'asc', 'ascending', -1 (descending) and 1 (ascending)
  paginationClass:"btn-link",
  paginationClassActive:"active",
  pageClosest: 3,
  perPage: 5,
  sortable: true,
  pagination: true, // default: false
  searchable: true,
  globalSearch: true,
  inputStyle: "border: 1px solid lightgray; padding:10px; border-radius:5px; font-size: 14px;",
  sortFunction: customSort
});
</script>