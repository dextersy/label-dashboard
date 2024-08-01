<?php
require_once('./inc/util/MySQLConnection.php');
require_once('./inc/model/loginattempt.php');

class LoginAttemptViewItem {
    public $username;
    public $name;
    public $date_and_time;
    public $result;
    public $remote_ip;
    public $proxy_ip;

    function __construct($username, $name, $date_and_time, $result, $remote_ip = null, $proxy_ip = null) {
        $this->username = $username;
        $this->name = $name;
        $this->date_and_time = $date_and_time;
        $this->result = $result;
        $this->remote_ip = $remote_ip;
        $this->proxy_ip = $proxy_ip;
    }
}
function getRecentLoginAttempts($brand_id, $limit = 30){
    $query = "SELECT u.username, u.first_name, u.last_name, l.date_and_time, l.status, l.proxy_ip, l.remote_ip " .
                "FROM `login_attempt` l JOIN `user` u ON l.user_id = u.id ".
                "WHERE l.brand_id = '" . $brand_id ."' ".
                "ORDER BY `date_and_time` DESC LIMIT 0, " . $limit;
    $result = MySQLConnection::query($query);
    
    if ($result->num_rows < 1) {
        return null;
    }
    
    $i = 0;
    while($row = $result->fetch_assoc()) {
        $loginAttempts[$i++] = new LoginAttemptViewItem(
            $row['username'], 
            $row['first_name'] . " " . $row['last_name'], 
            $row['date_and_time'], 
            $row['status'], 
            $row['remote_ip'], 
            $row['proxy_ip']
        );
    }
    return $loginAttempts;
}

?>