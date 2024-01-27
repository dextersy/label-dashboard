<?  
    class ChildBrand {
        public $brand_id;
        public $brand_name;
        public $earnings;
        public $payments;

        public function __construct($brand_id, $brand_name, $earnings, $payments) {
            $this->brand_id = $brand_id;
            $this->brand_name = $brand_name;
            $this->earnings = $earnings;
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
            $earnings = 0; // TODO Get actual earnings (earnings less royalties)
            $payments = 0; // TODO Get actual payments
            $childBrands[$i++] = new ChildBrand(
                $row['id'],
                $row['brand_name'],
                $earnings,
                $payments
            );
        }
        return $childBrands;
    }

?>