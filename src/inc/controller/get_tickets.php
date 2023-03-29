<?  
    include_once('./inc/model/ticket.php');

    function getTicketsForEvent($event){
        $sql = "SELECT * FROM `ticket` ".
            "WHERE `event_id` = " . $event;
        $result = MySQLConnection::query($sql);
        if ($result->num_rows < 1) {
            return null;
        }
    
        $i = 0;
        while($row = $result->fetch_assoc()) {
            $tickets[$i++] = new Ticket(
                $row['id'],
                $row['event_id'],
                $row['name'],
                $row['email_address'],
                $row['contact_number'],
                $row['number_of_entries'],
                $row['ticket_code'],
                $row['status']
            );
        }
        return $tickets;
    }

?>