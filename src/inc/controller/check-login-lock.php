<?php
    include_once('./inc/config.php');

    function checkLoginLock($user_id) {

        $sql = "SELECT * FROM `login_attempt` WHERE user_id = '" . $user_id . "' ORDER BY `date_and_time` DESC LIMIT 0, " . FAILED_LOGIN_LIMIT; // 3 is the limit of login
        $result = MySQLConnection::query($sql);
        if ($result->num_rows < FAILED_LOGIN_LIMIT) {
            return false;
        }
        
        $failures = 0;
        
        $now = new DateTime();
        $interval = new DateInterval("PT" . LOCK_TIME_IN_SECONDS . "S");
        $interval->invert = 1;
        $cutoff = $now->add($interval);

        while($row = $result->fetch_assoc()) {
            $login_time = datetime::createfromformat("Y-m-d H:i:s", $row['date_and_time']);
            if ($row['status'] == 'Failed' && $login_time > $cutoff) {
                $failures++;
            }
        }
    
        if ($failures >= FAILED_LOGIN_LIMIT) {
            return true;
        }
        else {
            return false;
        }
    }

?>