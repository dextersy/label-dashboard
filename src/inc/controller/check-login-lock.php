<?php
    include_once('./inc/config.php');

    function checkLoginLock($user_id) {

        $sql = "SELECT * FROM `login_attempt` WHERE user_id = '" . $user_id . "' ORDER BY `date_and_time` DESC LIMIT 0, " . FAILED_LOGIN_LIMIT; // 3 is the limit of login
        $result = MySQLConnection::query($sql);
        if ($result->num_rows < FAILED_LOGIN_LIMIT) {
            return false;
        }
        
        $failures = 0;
        $latest_login_time = null;
        while($row = $result->fetch_assoc()) {
            if ($latest_login_time == null) {
                $latest_login_time = datetime::createfromformat("Y-m-d H:i:s", $row['date_and_time']);
            }
            if ($row['status'] == 'Failed') {
                $failures++;
            }
        }
    
        if ($failures >= FAILED_LOGIN_LIMIT) {
            // Check if lock is still on
            $lock_expire_time = $latest_login_time->add(new DateInterval('PT' . LOCK_TIME_IN_SECONDS . 'S'));
            $now = new DateTime('now');
            if ($now > $lock_expire_time) {
                return false;
            }
            else {
                return true;
            }
        }
    }

?>