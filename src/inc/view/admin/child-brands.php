<?
    require_once('./inc/model/brand.php');
    require_once('./inc/controller/get_child_brands.php');

    $brands = getChildBrands($_SESSION['brand_id']);
?>
<h3>Sub-brands</h3>
<div class="table-responsive">
    
<? 
    $overallTotalPayables = 0;
    if ($brands) {
?>
    <table class="table">
        <thead>
        <tr><th>Brand ID</th>
            <th>Brand Name</th>
            <th style="text-align:right;">Net earnings</th>
            <th style="text-align:right;">Commission</th>
            <th style="text-align:right;">Payments made</th>
            <th style="text-align:right;">Payable balance</th>
        </thead>
        <tbody>
<?
        foreach ($brands as $brand) { 
            $commission = $brand->earnings * 0.2; //TODO Make commission configurable
            $balance = $brand->earnings - $commission - $brand->payments;
            if ($balance != 0) {
                $overallTotalPayables += $totalBalance;
            }
        ?>
            <tr>
                <td><?=$brand->brand_id;?></td>
                <td><?=$brand->brand_name;?></td>
                <td style="text-align:right;">Php<?=number_format($brand->earnings,2);?></td>
                <td style="text-align:right;">Php<?=number_format($commission,2);?></td>
                <td style="text-align:right;">Php<?=number_format($brand->payments,2);?></td>
                <td style="text-align:right;"><strong>Php<?=number_format($balance,2);?></strong></td>
            </tr>
<?
        }
?>
        </tbody>
    </table>
<?
    } else { ?>
    No child brands.
<?  } ?>
</div>
<div class="row">
    <div class="col-md-4">
        <div class="card">

            <div class="header">
                <h4 class="title">Total Balance</h4>
            </div>
            <div class="content">
                <h3>Php <?=number_format($overallTotalPayables,2);?></h3>
            </div>
        </div>
    </div>
</div>
