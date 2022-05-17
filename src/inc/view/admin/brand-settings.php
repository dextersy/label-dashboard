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
<h3>Brand Settings</h3>
<form action="<?=$formAction;?>" method="POST" enctype="multipart/form-data">
    <input type="hidden" name="id" value="<?=$brand->id;?>">
    <div class="row">
        <div class="col-md-5">
            <div class="form-group">
                <label for="profile_photo">Logo</label><br>
                <img src="<?=($brand->logo_url!="") ? $brand->logo_url : "assets/img/placeholder.jpg";?>" width="300" style="background-color:#cccccc;"><br>
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
                <label for="name">Brand color <?=$brand->color;?></label>
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

            <button type="submit" class="btn btn-default">Save Changes</button>
        </div>
    </div>
</form>
<h3>Domains</h3>
<p>These domains will resolve to your dashboard.</p>
<div class="col-md-4">
    <div class="table-responsive">
        <table class="table">
            <tbody>
<? 
    $domains = Domain::getDomainsForBrand($_SESSION['brand_id']);
    if ($domains) {
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
        } 
    } else { ?>
    No domains configured.
<?  } ?>
            </tbody>
        </table>
    </div>
    
    <h4>Add domain</h4>
    <form action="action.add-domain.php" method="POST" enctype="multipart/form-data">
    <input type="hidden" name="brand_id" value="<?=$brand->id;?>">
    <input type="text" class="form-control" name="domain_name">
    <button type="submit" class="btn btn-default">Add</button>
    </form>

</div>