<?
    include_once('./inc/controller/get-recuperable-expense.php');
    include_once('./inc/controller/get-release-list.php');

    $releases = getReleaseListForArtist($_SESSION['current_artist']);
?>
<div class="table-responsive">
    <table class="table">
        <thead>
            <tr><th>For Release</th>
            <th>Remaining Recuperable Expense</th>
        </thead>
        <tbody>
        <? if ($releases != null) {
                foreach($releases as $release) {
                    $balance = getRecuperableExpenseBalance($release->id);
                    if ($balance > 0) {
        ?>
            <tr>
                <td><?=$release->title;?></td>
                <td align="right"><?=number_format($balance, 2);?></td>
            </tr>
        <?
                    }
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