<?
    include_once('./inc/controller/get-recuperable-expense.php');
    include_once('./inc/controller/get-release-list.php');
    include_once('./inc/controller/get-royalties.php');
    include_once('./inc/controller/get-earnings.php');
    include_once('./inc/model/releaseartist.php');
    include_once('./inc/controller/access_check.php');

    session_start();
    $releases = getReleaseListForArtist($_SESSION['current_artist']);
?>
<script type="text/javascript">
    function onClickAddRecuperableExpense(release_id, release_name) {
        document.getElementById('add-recuperable-expense').style.display="block";
        document.getElementById('add_recuperable_expense_release_id').value = release_id;
        document.getElementById('add_recuperable_expense_release').innerHTML = release_name;
    }
    function onClickCancel() {
        document.getElementById('add-recuperable-expense').style.display="none";
    }
    function toggleEdit(){
        let i = 1;
        while(document.getElementById('sync_royalty_' + i)) {
            document.getElementById('sync_royalty_' + i).disabled = !document.getElementById('sync_royalty_' + i).disabled;
            document.getElementById('streaming_royalty_' + i).disabled = !document.getElementById('streaming_royalty_' + i).disabled;
            document.getElementById('download_royalty_' + i).disabled = !document.getElementById('download_royalty_' + i).disabled;
            document.getElementById('physical_royalty_' + i).disabled = !document.getElementById('physical_royalty_' + i).disabled;
            i++;
        }

        let edit_button = document.getElementById('edit_button');
        if(edit_button.style.display == 'block') {
            edit_button.style.display = 'none';
        }
        else {
            edit_button.style.display = 'block';
        }

        let save_changes_buttons = document.getElementById('save_changes_buttons');
        if(save_changes_buttons.style.display == 'block') {
            save_changes_buttons.style.display = 'none';
        }
        else {
            save_changes_buttons.style.display = 'block';
        }
    }
</script>
<form action="action.update-royalties.php" method="POST" enctype="multipart/form-data">
    <div class="card">
        <div class="card-header"><h3>Release Information</h3></div>
        <div class="card-body">
            <p class="card-text">This tab shows financial details regarding your release, including splits, recuperable expenses, earnings, and revenues.</p>
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr><th>For Release</th>
                        <th>Sync royalty %</th>
                        <th>Streaming royalty %</th>
                        <th>Downloads royalty %</th>
                        <th>Physical royalty %</th>
                        <th>Remaining Recuperable Expense</th>
                        <th>Total earnings 
                        <i class="fa fa-info-circle" data-toggle="tooltip" data-placement="top" title="Data starts on April 2021.">
                        </th>
                        <th>Total royalties earned</th>
                    </thead>
                    <tbody>
                    <? if ($releases != null) {
                            $i = 1;
                            foreach($releases as $release) {
                                $recuperableExpense = getRecuperableExpenseBalance($release->id);
                                $royalties = getTotalRoyaltiesForArtistForRelease($_SESSION['current_artist'], $release->id);
                                $earnings = getTotalEarningsForRelease($release->id);
                                
                                $artistRelease = new ReleaseArtist;
                                $artistRelease->fromID($_SESSION['current_artist'], $release->id);
                                $sync_royalty = "% of " . $artistRelease->sync_royalty_type;
                                $streaming_royalty = "% of " . $artistRelease->streaming_royalty_type;
                                $download_royalty = "% of " . $artistRelease->download_royalty_type;
                                $physical_royalty = "% of " . $artistRelease->physical_royalty_type;
                    ?>
                        <tr>
                            <td width="15%"><strong><?=$release->title;?></strong></td>
                            <td>
                                <input type="hidden" name="artist_id_<?=$i;?>" value="<?=$_SESSION['current_artist'];?>">
                                <input type="hidden" name="release_id_<?=$i;?>" value="<?=$release->id;?>">
                                <div class="input-group">
                                    <input id="sync_royalty_<?=$i;?>" name="sync_royalty_<?=$i;?>" type="text" class="form-control" max="100" value="<?=$artistRelease->sync_royalty_percentage * 100;?>" disabled> 
                                    <div class="input-group-addon"><?=$sync_royalty;?></div>
                                </div>
                            </td>
                            <td>
                                <div class="input-group">
                                    <input id="streaming_royalty_<?=$i;?>" name="streaming_royalty_<?=$i;?>" type="text" class="form-control" max="100" value="<?=$artistRelease->streaming_royalty_percentage * 100;?>" disabled> 
                                    <div class="input-group-addon"><?=$streaming_royalty;?></div>
                                </div>
                            </td>
                            <td>
                                <div class="input-group">
                                    <input id="download_royalty_<?=$i;?>" name="download_royalty_<?=$i;?>" type="text" class="form-control" max="100" value="<?=$artistRelease->download_royalty_percentage * 100;?>" disabled>
                                    <div class="input-group-addon"><?=$download_royalty;?></div>
                                </div>
                            </td>
                            <td>
                                <div class="input-group">
                                    <input id="physical_royalty_<?=$i;?>" name="physical_royalty_<?=$i;?>" type="text" class="form-control" max="100" value="<?=$artistRelease->physical_royalty_percentage * 100;?>" disabled>
                                    <div class="input-group-addon"><?=$physical_royalty;?></div>
                                </div>
                            </td>
                            <td align="right"><?=number_format($recuperableExpense, 2);?>
                            <?php if ($isAdmin) { ?>
                            <a href="#" onclick="onClickAddRecuperableExpense(<?=$release->id;?>, '<?=str_replace("'","\'", $release->title);?>');"><i class="fa fa-plus"></i></a>
                            <?php } ?> 
                            </td>
                            <td align="right"><?=number_format($earnings, 2);?></td>
                            <td align="right"><?=number_format($royalties, 2);?></td>
                        </tr>
                    <?
                                $i++;
                            }
                        } else {
                    ?>
                    No releases yet.
                    <?
                        }
                    ?>
                    </tbody>
                </table>
            </div>
        </div>
    <? if($isAdmin) { ?>
        <div class="card-footer text-right">
            <div id="edit_button" style="display:block">
                <button type="button" class="btn btn-primary" onClick="toggleEdit();">Edit Royalties</button> 
            </div>
            <div id="save_changes_buttons" style="display:none">
                <input type="submit" class="btn btn-primary" value="Save Changes"> 
            </div>
        </div>
    <? } ?>
    </div>
</form>
<div id="add-recuperable-expense" class="row" style="display:none">
    <div class="col-md-4">
        <form action="action.add-recuperable-expense.php" method="POST">
            <input type="hidden" id="add_recuperable_expense_release_id" name="release_id" value="">
            <input type="hidden" id="add_recuperable_expense_brand_id" name="brand_id" value="<?=$_SESSION['brand_id'];?>">
            <h4>Add recuperable expense for:</label> <span id="add_recuperable_expense_release"></span></h4>
            <label for="expenseDate">Recorded Date</label>
            <input type="date" class="form-control" id="expenseDate" name="date_recorded" value="<?=date("Y-m-d");?>">
            <label for="description">Description</label>
            <input type="text" class="form-control" id="add_recuperable_expense_description" name="expense_description" placeholder="Description">
            <label for="amount">Amount (in PHP)</label>
            <input type="text" class="form-control" id="add_recuperable_expense_amount" name="expense_amount" placeholder="Amount">
            <button type="submit" class="btn btn-default">Add</button><button type="button" class="btn btn-default" onClick="onClickCancel()">Cancel</button>
        </form>
    </div>
</div>