<?  
    class ChildBrand {
        public $brand_id;
        public $brand_name;
        public $music_earnings;
        public $event_earnings;
        public $payments;

        public function __construct($brand_id, $brand_name, $music_earnings, $event_earnings, $payments) {
            $this->brand_id = $brand_id;
            $this->brand_name = $brand_name;
            $this->music_earnings = $music_earnings;
            $this->event_earnings = $event_earnings;
            $this->payments = $payments;
        }
        
    }

    function getChildBrands($parent_brand_id, $start_date = null, $end_date = null){
        $sql = "SELECT * FROM `brand` ".
            "WHERE `parent_brand` = '" . $parent_brand_id . "'";
        
        $result = MySQLConnection::query($sql);
        if ($result->num_rows < 1) {
            return null;
        }
    
        $i = 0;
        while($row = $result->fetch_assoc()) {
            $music_earnings = 0;
            $event_earnings = 0;

            // Get total music earnings...
            $sql = "SELECT SUM(`amount`) AS `total_earning` FROM `earning` WHERE `release_id` IN " .
                "(SELECT id FROM `release` WHERE `brand_id` = '" . $row['id'] . "')"; // TODO : Add date filter
            $result2 = MySQLConnection::query($sql);
            if($result2->num_rows > 0 && $row2 = $result2->fetch_assoc()) {
                $music_earnings = $row2['total_earning'];
            }
            // ...Less - royalties
            $sql = "SELECT SUM(`amount`) AS `total_royalties` FROM `royalty` WHERE `release_id` IN " .
                "(SELECT id FROM `release` WHERE `brand_id` = '" . $row['id'] . "')"; // TODO : Add date filter
            $result2 = MySQLConnection::query($sql);
            if($result2->num_rows > 0 && $row2 = $result2->fetch_assoc()) {
                $music_earnings -= $row2['total_royalties'];
            }

            // Get total ticket sales less payment processing fee
            $sql = "SELECT SUM(`price_per_ticket` * `number_of_entries`) AS `total_sales`, SUM(`payment_processing_fee`) AS `total_processing_fee` " . 
                "FROM `ticket` WHERE `status` IN ('Payment confirmed', 'Ticket sent.') AND " .
                "`event_id` IN (SELECT `id` FROM `event` WHERE `brand_id` = '" . $row['id'] . "')"; // TODO: Add date filter
            $result2 = MySQLConnection::query($sql);
            if($result2->num_rows > 0 && $row2 = $result2->fetch_assoc()) {
                $event_earnings += ($row2['total_sales'] - $row2['total_processing_fee']);
            }

            $payments = 0; // TODO Get actual payments
            $childBrands[$i++] = new ChildBrand(
                $row['id'],
                $row['brand_name'],
                $music_earnings,
                $event_earnings,
                $payments
            );
        }
        return $childBrands;
    }

?>