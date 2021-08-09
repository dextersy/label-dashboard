<?
    class UserAccessRights {
        public $user_id;
        public $first_name;
        public $last_name;
        public $email_address;
        public $artistAccess;
        public $financialAccess;
        public $status;
        public $invite_hash;

        public function __construct($user_id, $first_name, $last_name, $email_address, $artistAccess, $financialAccess, $status, $invite_hash) {
            $this->user_id = $user_id;
            $this->first_name = $first_name;
            $this->last_name = $last_name;
            $this->email_address = $email_address;
            $this->artistAccess = $artistAccess;
            $this->financialAccess = $financialAccess;
            $this->status = $status;
            $this->invite_hash = $invite_hash;
        }
    }

    function getTeamMembersForArtist($artist){
        $sql = "SELECT * FROM `artist_access` ".
            "INNER JOIN `user` ON `artist_access`.`user_id` = `user`.`id` ".
            "WHERE `artist_id` = " . $artist;
        $result = MySQLConnection::query($sql);
        if ($result->num_rows < 1) {
            return null;
        }
    
        $i = 0;
        while($row = $result->fetch_assoc()) {
            $userAccessRights[$i++] = new UserAccessRights(
                $row['user_id'],
                $row['first_name'],
                $row['last_name'],
                $row['email_address'],
                null,
                null,
                $row['status'],
                $row['invite_hash']
            );
        }
        return $userAccessRights;
    }
?>