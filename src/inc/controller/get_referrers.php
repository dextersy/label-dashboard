<?  
    include_once('./inc/model/eventreferrer.php');

    function getReferrersForEvent($event){
        $sql = "SELECT * FROM `event_referrer` ".
            "WHERE `event_id` = " . $event;
        $result = MySQLConnection::query($sql);
        if ($result->num_rows < 1) {
            return null;
        }
    
        $i = 0;
        while($row = $result->fetch_assoc()) {
            $referrers[$i++] = new EventReferrer(
                $row['id'],
                $row['name'],
                $row['referral_code'],
                $row['event_id'],
                $row['referral_shortlink']
            );
        }
        return $referrers;
    }


    class EventReferrerSales {
        public $id;
        public $tickets_sold;
        public $gross_amount_sold;
        public $net_amount_sold;

        function __construct(
            $id = null,
            $tickets_sold = null,
            $gross_amount_sold = null,
            $net_amount_sold = null
        ) {
            $this->id = $id;
            $this->tickets_sold = $tickets_sold;
            $this->gross_amount_sold = $gross_amount_sold;
            $this->net_amount_sold = $net_amount_sold;
        }
    }
    function getReferrerSales($id) {
        $sql = "SELECT * FROM `ticket` WHERE `referrer_id` = '" . $id . "' AND `status` IN ('Payment Confirmed', 'Ticket sent.')";
        $result = MySQLConnection::query($sql);
        
        $tickets_sold = 0;
        $gross_amount_sold = 0;
        $net_amount_sold = 0;
        while($row = $result->fetch_assoc()) {
            $tickets_sold += $row['number_of_entries'];
            $gross_amount_sold += $row['price_per_ticket'] * $row['number_of_entries'];
            $net_amount_sold = $gross_amount_sold - $row['payment_processing_fee'];
        }
        $referrerSales = new EventReferrerSales(
            $id,
            $tickets_sold,
            $gross_amount_sold,
            $net_amount_sold
        );
        return $referrerSales;
    }

    function getReferrerFromCode($code) {
        $sql = "SELECT * FROM `event_referrer` " .
            "WHERE `referral_code` = '" . $code . "'" .
            "LIMIT 0,1";
        $result = MySQLConnection::query($sql);
        if ($result->num_rows < 1) {
            return null;
        }
    
        if($row = $result->fetch_assoc()) {
            $referrer = new EventReferrer(
                $row['id'],
                $row['name'],
                $row['referral_code'],
                $row['event_id'],
                $row['referral_shortlink']
            );
            return $referrer;
        }
        return null; 
    }

?>