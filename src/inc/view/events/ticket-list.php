<?
    include_once('./inc/controller/get_tickets.php');

    include_once('./inc/controller/brand_check.php');

    $tickets = getTicketsForEvent($_SESSION['current_event']);
?>
<h3>Tickets</h3>
<div class="table-responsive">
    <table class="table">
        <thead>
            <tr><th>Name</th>
            <th>Email address</th>
            <th>Contact number</th>
            <th>No. of tickets</th>
            <th>Ticket code</th>
            <th>Status</th>
        </thead>
        <tbody>
<?
    if ($tickets) {
        foreach($tickets as $ticket) {
?>
            <tr>
                <td><?=$ticket->name; ?></td>
                <td><?=$ticket->email_address; ?></td>
                <td><?=$ticket->contact_number; ?></td>
                <td><?=$ticket->number_of_entries; ?></td>
                <td><strong><?=$ticket->ticket_code; ?></strong></td>
                <td><?=$ticket->status; ?></td>
            </tr>
<?      }
    } else {
?>
    No tickets yet.
<?
    } 
?>
        </tbody>
    </table>
</div>
<div class="row">
    <div class="col-md-6">
        <h4>Add ticket</h4>
        <form action="action.add-ticket.php" method="POST">
        <div class="form-group">
            <input type="hidden" name="event_id" value="<?=$_SESSION['current_event'];?>">
            <input type="hidden" name="status" value="New">
            <input type="name" class="form-control" id="name" name="name" placeholder="name">
            <input type="email" class="form-control" id="email_address" name="email_address" placeholder="Email address">
            <input type="phone" class="form-control" id="contact_number" name="contact_number" placeholder="Contact number">
            <input type="text" class="form-control" id="number_of_entries" name="number_of_entries" placeholder="Number of tickets">
            <input type="submit" class="btn btn-primary" value="Add Ticket">
        </div>                 
        </form>
    </div>
</div>