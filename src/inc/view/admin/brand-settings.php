<?php
require_once('./inc/controller/access_check.php');
require_once('./inc/controller/brand_check.php');
require_once('./inc/model/brand.php');
require_once('./inc/model/domain.php');

$brand = new Brand;
$brand->fromID($_SESSION['brand_id']);

$formAction = "action.update-brand.php?from=" . $_SERVER['REQUEST_URI'];

include_once("./inc/view/admin/brand-setting-alert-message.php");
?>
<form action="<?=$formAction;?>" method="POST" enctype="multipart/form-data">
    <input type="hidden" name="id" value="<?=$brand->id;?>">
    <div class="row">
        <div class="col-md-6">
            <div class="card">
                <div class="card-header"><h5>General Settings</h5></div>
                <div class="card-body">
                    <div class="form-group">
                        <label for="profile_photo">Logo</label><br>
                        <img src="<?=($brand->logo_url!="") ? $brand->logo_url : "assets/img/placeholder.jpg";?>" width="250" style="background-color:#cccccc;"><br>
                        <input type="file" class="form-control" id="logo_url" name="logo_url" accept=".jpg, .png" />
                    </div>
                    <div class="form-group">
                        <label for="name">Name</label>
                        <input type="text" class="form-control" id="brand_name" name="brand_name" placeholder="Brand Name" value="<?=$brand->brand_name;?>">
                    </div>
                    <div class="form-group">
                        <label for="name">Website</label><i class="fa fa-info-circle" data-toggle="tooltip" data-placement="top" title="This will be linked to your logo. Include http or https in the URL (e.g. https://yourbrand.com)"></i>
                        <input type="text" class="form-control" id="brand_website" name="brand_website" placeholder="Brand Website" value="<?=$brand->brand_website;?>">
                    </div>
                    <div class="form-group">
                        <label for="name">Brand color <span style="color:<?=$brand->brand_color;?>;"><i class="fa fa-square"></i></span></label>
                        <select class="form-control" name="brand_color">
                            <option <?=$brand->brand_color=='purple'?"selected":"";?> value="purple">Purple</option>
                            <option <?=$brand->brand_color=='red'?"selected":"";?> value="red">Red</option>
                            <option <?=$brand->brand_color=='blue'?"selected":"";?> value="blue">Blue</option>
                            <option <?=$brand->brand_color=='azure'?"selected":"";?> value="azure">Azure</option>
                            <option <?=$brand->brand_color=='green'?"selected":"";?> value="green">Green</option>
                            <option <?=$brand->brand_color=='black'?"selected":"";?> value="black">Black</option>
                            <option <?=$brand->brand_color=='white'?"selected":"";?> value="white">White</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="favicon_url">Favicon</label><br>
                        <div class="input-group">
                            <div class="input-group-addon"><img src="<?=($brand->favicon_url!="") ? $brand->favicon_url : "assets/img/placeholder.jpg";?>" width="20" style="background-color:#cccccc;"></div>
                            <input type="file" class="form-control" id="favicon_url" name="favicon_url" accept=".png" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-6">
            <div class="card">
                <div class="card-header"><h5>Catalog</h5></div>
                <div class="card-body">
                    <div class="form-group">
                        <label for="name">Catalog Prefix</label><i class="fa fa-info-circle" data-toggle="tooltip" data-placement="top" title="For autogenerated catalog number (e.g. CAT001)"></i>
                        <input type="text" class="form-control" id="catalog_prefix" name="catalog_prefix" placeholder="Catalog Prefix" value="<?=$brand->catalog_prefix;?>">
                    </div>
                    <div class="form-group">
                        <label for="name">Release Submission URL</label><i class="fa fa-info-circle" data-toggle="tooltip" data-placement="top" title="Link to the form where your artists should submit their releases."></i>
                        <input type="text" class="form-control" id="release_submission_url" name="release_submission_url" placeholder="Release Submission URL" value="<?=$brand->release_submission_url;?>">
                    </div>
                </div>
            </div>
            <div class="card">
                <div class="card-header"><h5>Payments</h5></div>
                <div class="card-body">
                    <div class="form-group">
                        <label for="name">Paymongo Wallet ID (optional)</label>
                        <input type="password" class="form-control" id="txtHidden_paymongoWalletID" name="paymongo_wallet_id" placeholder="Paymongo Wallet ID" value="<?=$brand->paymongo_wallet_id;?>">
                    </div>

                    <div class="form-group">
                        <label for="name">Processing fee for payouts</label>
                        <div class="input-group">
                            <div class="input-group-addon">₱</div>
                            <input type="text" class="form-control" id="txt_processingFeeForPayouts" name="payment_processing_fee_for_payouts" placeholder="Payment processing fee" value="<?=$brand->payment_processing_fee_for_payouts;?>">
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="row save-panel">
        <button type="submit" class="btn btn-block btn-primary"><i class="fa fa-save"></i> Save Changes</button>
    </div>
</form>
<hr>
<div class="row">
<div class="col-md-4">
<div class="card">
    <div class="card-header"><h3>Domains</h3></div>
    <div class="card-body">
        <p>These domains will resolve to your dashboard.</p>
    <? 
        $domains = Domain::getDomainsForBrand($_SESSION['brand_id']);
        if ($domains) {
    ?>
        <div class="table-responsive">
            <table class="table">
                <tbody>
    <?
            foreach ($domains as $domain) { 
            ?>
                <tr>
                    <td><?=$domain->domain_name;?></td>
                    <td>
                        <?=$domain->status == "Verified" ? "<i class=\"fa fa-check\" alt=\"Verified\"></i>" : "<a href=\"action.verify-domain.php?brand_id=" . $_SESSION['brand_id'] . "&domain_name=" . $domain->domain_name . "\">[ Verify ]</as>";?>
                        <a href="action.delete-domain.php?brand_id=<?=$_SESSION['brand_id'];?>&domain_name=<?=$domain->domain_name;?>">
                        <i class="fa fa-trash"></i></a>
                    </td>
                </tr>
<?          
            } ?>
                </tbody>
            </table>
<?
        } else { ?>
        No domains configured.
    <?  } ?>
        </div>
        <h4>Add domain</h4>
        <form action="action.add-domain.php" method="POST" enctype="multipart/form-data">
        <input type="hidden" name="brand_id" value="<?=$brand->id;?>">
        <div class="input-group">
            <input type="text" class="form-control" name="domain_name">
            <div class="input-group-addon">
                <button type="submit" class="btn-link">Add</button>
            </div>
        </div>
        </form>

    </div>
</div>
</div>
</div>