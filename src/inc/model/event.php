<?php

require_once('./inc/util/MySQLConnection.php');

class Event {

    public $id;
    public $brand_id;
    public $title;
    public $date_and_time;
    public $description;
    public $poster_url;
    public $venue;
    public $rsvp_link;
    public $ticket_price;
    public $buy_shortlink;
    public $close_time;
    public $verification_pin;
    public $verification_link;

    function __construct(
        $id = null, 
        $brand_id = null,
        $title = null, 
        $date_and_time = null,
        $description = null,
        $poster_url = null,
        $venue = null,
        $rsvp_link = null,
        $ticket_price = null,
        $buy_shortlink = null,
        $close_time = null,
        $verification_pin = null,
        $verification_link = null
    ) 
    {
        $this->id = $id;
        $this->brand_id = $brand_id;
        $this->title = $title; 
        $this->date_and_time = $date_and_time;
        $this->description = $description;
        $this->poster_url = $poster_url;
        $this->venue = $venue;
        $this->rsvp_link = $rsvp_link;
        $this->ticket_price = $ticket_price;
        $this->buy_shortlink = $buy_shortlink;
        $this->close_time = $close_time;
        $this->verification_pin = $verification_pin;
        $this->verification_link = $verification_link;
    }

    function fromID($id) {
        $result = MySQLConnection::query("SELECT * FROM `event` WHERE `id` = " . $id);
        if ($result->num_rows > 0 && $row = $result->fetch_assoc()) {
            $this->id = $row['id'];
            $this->brand_id = $row['brand_id'];
            $this->title = $row['title']; 
            $this->date_and_time = $row['date_and_time'];
            $this->description = $row['description'];
            $this->poster_url = $row['poster_url'];
            $this->venue = $row['venue'];
            $this->rsvp_link = $row['rsvp_link'];
            $this->ticket_price = $row['ticket_price'];
            $this->buy_shortlink = $row['buy_shortlink']; 
            $this->close_time = $row['close_time'];
            $this->verification_pin = $row['verification_pin'];
            $this->verification_link = $row['verification_link'];
            return true;
        }
        else {
            return false;
        }
    }

    function fromFormPOST($post) {
        if (isset($_POST['id']) && $_POST['id'] != '') {
            $this->id = $_POST['id'];
            $this->fromID($this->id);
        }
        $this->brand_id = $post['brand_id'];
        $this->title = $post['title']; 
        $this->date_and_time = $post['date_and_time'];
        $this->description = $post['description'];
        $this->venue = $post['venue'];
        $this->rsvp_link = $post['rsvp_link'];
        $this->ticket_price = $post['ticket_price'];
        if(isset($post['buy_shortlink'])) {
            $this->buy_shortlink = $post['buy_shortlink'];
        }
        if(isset($post['close_time'])) {
            $this->close_time = $post['close_time'];
        }
        if(isset($post['verification_pin'])) {
            $this->verification_pin = $post['verification_pin'];
        }
        if(isset($post['verification_link'])) {
            $this->verification_link = $post['verification_link'];
        }
    }

    function save() {
        if ($this->id == null) {
            $sql = "INSERT INTO `event` (`brand_id`, `title`, `date_and_time`, `description`, `poster_url`, `venue`, `rsvp_link`, `ticket_price`, `buy_shortlink`, `close_time`, `verification_pin`, `verification_link`) ".
                "VALUES(" .
                "'" . MySQLConnection::escapeString($this->brand_id) . "', ".
                "'" . MySQLConnection::escapeString($this->title) . "', ".
                "'" . MySQLConnection::escapeString($this->date_and_time) . "', ".
                "'" . MySQLConnection::escapeString($this->description) . "', ".
                "'" . MySQLConnection::escapeString($this->poster_url) . "', ".
                "'" . MySQLConnection::escapeString($this->venue) . "', ".
                "'" . MySQLConnection::escapeString($this->rsvp_link) . "', ".
                "'" . MySQLConnection::escapeString($this->ticket_price) . "', ".
                "'" . MySQLConnection::escapeString($this->buy_shortlink) . "', ".
                "'" . MySQLConnection::escapeString($this->close_time) . "', ".
                "'" . MySQLConnection::escapeString($this->verification_pin) . "', ".
                "'" . MySQLConnection::escapeString($this->verification_link) . "'" .
                ")";
        }
        else {
            $sql = "UPDATE `event` SET ".
                "`brand_id` = '" . MySQLConnection::escapeString($this->brand_id) . "', " .
                "`title` = '" . MySQLConnection::escapeString($this->title) . "', " .
                "`date_and_time` = '" . MySQLConnection::escapeString($this->date_and_time) . "', " .
                "`description` = '" . MySQLConnection::escapeString($this->description) . "', " .
                "`poster_url` = '" . MySQLConnection::escapeString($this->poster_url) . "', " .
                "`venue` = '" . MySQLConnection::escapeString($this->venue) . "', " .
                "`rsvp_link` = '" . MySQLConnection::escapeString($this->rsvp_link) . "', " .
                "`ticket_price` = '" . MySQLConnection::escapeString($this->ticket_price) . "', " .
                "`buy_shortlink` = '" . MySQLConnection::escapeString($this->buy_shortlink) . "', " .
                "`close_time` = '" . MySQLConnection::escapeString($this->close_time) . "', " .
                "`verification_pin` = '" . MySQLConnection::escapeString($this->verification_pin) . "', " .
                "`verification_link` = '" . MySQLConnection::escapeString($this->verification_link) . "' " .
                "WHERE `id` = " . $this->id;
        }
        $result = MySQLConnection::query($sql);
        if ($result) {
            if ($this->id == null) {
                $this->id = MySQLConnection::$lastInsertID;
            }
            return $this->id;
        }
        else {
            return false;
        }
    }
}

?>
