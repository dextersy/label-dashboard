<?php
require_once('./inc/controller/access_check.php');
require_once('./inc/controller/brand_check.php');
require_once('./inc/model/brand.php');

$brand = new Brand;
$brand->fromID($_SESSION['brand_id']);

$formAction = "action.update_brand.php?from=" . $_SERVER['REQUEST_URI'];

?>
<h3><?=$title;?></h3>
<form action="<?=$formAction;?>" method="POST" enctype="multipart/form-data">
    <input type="hidden" name="id" value="<?=$brand->id;?>">
    <div class="row">
        <div class="col-md-5">
            <div class="form-group">
                <img src="<?=($brand->logo_url!="") ? $brand->logo_url : "assets/img/placeholder.jpg";?>" width="300" style="border:#cccccc 1px solid; padding:5px;">
                <label for="profile_photo">Logo</label>
                <input type="file" class="form-control" id="logo_url" name="logo_url" accept=".jpg, .png" />
            </div>
            <div class="form-group">
                <label for="name">Name</label>
                <input type="text" class="form-control" id="brand_name" name="brand_name" placeholder="Brand Name" value="<?=$brand->brand_name;?>">
            </div>
            <div class="form-group">
                <label for="name">Brand color</label>
                <select name="brand_color">
                    <option <?=$brand->color=='purple'?"selected":"";?> value="purple">Purple</option>
                    <option <?=$brand->color=='red'?"selected":"";?> value="red">Red</option>
                    <option <?=$brand->color=='blue'?"selected":"";?> value="blue">Blue</option>
                    <option <?=$brand->color=='azure'?"selected":"";?> value="azure">Azure</option>
                    <option <?=$brand->color=='green'?"selected":"";?> value="green">Green</option>
                    <option <?=$brand->color=='black'?"selected":"";?> value="black">Black</option>
                    <option <?=$brand->color=='white'?"selected":"";?> value="white">White</option>
                </select>
            </div>

            <button type="submit" class="btn btn-default">Save Changes</button>
        </div>
    </div>
</form>