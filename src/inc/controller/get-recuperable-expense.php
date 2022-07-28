<?php
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/recuperableexpense.php');

function getRecuperableExpenseBalance($release_id){
    $sql = "SELECT SUM(`expense_amount`) AS `recup_expense_balance` FROM `recuperable_expense` WHERE `release_id` = '" . $release_id . "'";
    $result = MySQLConnection::query($sql);
    $i = 0;
    if($row = $result->fetch_assoc()) {
        return $row['recup_expense_balance'];
    }
    return null;
}

class RecuperableExpenseViewItem {
    public $date_recorded;
    public $release_title;
    public $description;
    public $expense_amount;
}

function getRecuperableExpensesForRelease($release_id, $start = 0, $limit = -1){
    $sql = "SELECT `id` FROM `recuperable_expense` " .
            "WHERE `release_id` = '". $artist_id . "' ".
            "ORDER BY id DESC";
    if ($limit >= 0) {
        $sql = $sql . " LIMIT ". $start .", " . $limit;
    }
    $result = MySQLConnection::query($sql);
    $i = 0;
    
    while($result->num_rows > 0 && $row = $result->fetch_assoc()) {
        $recuperable_expenses[$i] = new RecuperableExpense;
        $recuperable_expenses[$i]->fromID($row['id']);

        $recuperable_expense_view[$i] = new RecuperableExpenseViewItem;
        $recuperable_expense_view[$i]->description = $recuperable_expenses[$i]->description;
        $recuperable_expense_view[$i]->amount = $recuperable_expenses[$i]->expense_amount;

        if ($recuperable_expenses[$i]->release_id != null) {            
            $release = new Release;
            if($release->fromID($recuperable_expenses[$i]->release_id)) {
                $recuperable_expense_view[$i]->release_title = $release->catalog_no .": " . $release->title;        
            }
        }

        $i++;
    }
    return $recuperable_expense_view;
}

function getTotalNewRecuperableExpenseForPeriod($date_start, $date_end) {
    $sql = "SELECT SUM(`expense_amount`) AS `total_new_recuperable_expense` FROM `recuperable_expense` " .
        "WHERE `expense_amount` > 0 AND `date_recorded` BETWEEN '" . $date_start . "' AND '" . $date_end . "'";
    $result = MySQLConnection::query($sql);
    if($result->num_rows > 0 && $row = $result->fetch_assoc()) {
        $total = $row['total_new_recuperable_expense'];
    }
    return $total;
}

function getTotalRecuperatedExpenseForPeriod($date_start, $date_end) {
    $sql = "SELECT SUM(`expense_amount`) AS `total_new_recuperable_expense` FROM `recuperable_expense` " .
        "WHERE `expense_amount` < 0 AND `date_recorded` BETWEEN '" . $date_start . "' AND '" . $date_end . "'";
    $result = MySQLConnection::query($sql);
    if($result->num_rows > 0 && $row = $result->fetch_assoc()) {
        $total = $row['total_new_recuperable_expense'];
    }
    return $total;
}
?>