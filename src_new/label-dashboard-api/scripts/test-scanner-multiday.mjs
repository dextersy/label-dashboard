/**
 * Test script: Scanner multi-day event support
 *
 * ⚠️  WARNING: Run against a development or staging environment only.
 * This script creates real events and tickets in the database and does not
 * clean them up afterwards. Do NOT run against production.
 *
 * Usage:
 *   node scripts/test-scanner-multiday.mjs [base_url] [username] [password]
 *
 * Or set env vars:
 *   TEST_USERNAME, TEST_PASSWORD, TEST_BRAND_ID (default: 1)
 *
 * What this tests:
 *   - Scanner can log in and receives event days
 *   - Tickets valid for today are accepted
 *   - Tickets restricted to a different day are rejected
 *   - Check-in succeeds for valid ticket
 *   - Over-claiming is blocked
 *   - Removing an event day that has scan logs is blocked
 *   - Removing an event day with no scan logs still works
 */

const BASE_URL  = process.argv[2] || 'http://localhost:3000';
const USERNAME  = process.argv[3] || process.env.TEST_USERNAME;
const PASSWORD  = process.argv[4] || process.env.TEST_PASSWORD;
const BRAND_ID  = parseInt(process.env.TEST_BRAND_ID || '1', 10);
const SCANNER_PIN = '9999';

if (!USERNAME || !PASSWORD) {
  console.error('Usage: node test-scanner-multiday.mjs [base_url] <username> <password>');
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let adminToken = null;
let scannerToken = null;
const results = [];
const createdEventIds = [];

async function api(method, path, body, { scanner = false } = {}) {
  const token = scanner ? scannerToken : adminToken;
  const headers = {
    'Content-Type': 'application/json',
    'Origin': BASE_URL,
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const isGetHead = method === 'GET' || method === 'HEAD';
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: (body && !isGetHead) ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
}

function check(name, condition, detail = '') {
  condition ? pass(name, detail) : fail(name, detail);
}

function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`);
}

// Today and tomorrow in UTC (YYYY-MM-DD) to match how dates are stored
const todayUTC = new Date().toISOString().slice(0, 10);
const tomorrowUTC = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
// Use noon UTC to avoid any date boundary ambiguity
const TODAY_NOON    = `${todayUTC}T12:00:00.000Z`;
const TOMORROW_NOON = `${tomorrowUTC}T12:00:00.000Z`;

// ─── Setup ───────────────────────────────────────────────────────────────────

async function login() {
  section('Auth');
  const { status, data } = await api('POST', '/api/auth/login', {
    username: USERNAME, password: PASSWORD, brand_id: BRAND_ID
  });
  if (status !== 200 || !data?.token) {
    fail('Admin login', `HTTP ${status} — ${data?.error || 'no token'}`);
    process.exit(1);
  }
  adminToken = data.token;
  pass('Admin login');
}

async function setupEvent() {
  section('Setup');

  // Create a 2-day event: day 1 = today, day 2 = tomorrow
  const { status, data } = await api('POST', '/api/events', {
    title: `[TEST] Scanner Multiday ${Date.now()}`,
    date_and_time: TODAY_NOON,
    venue: 'Test Venue',
    ticketing_enabled: true,
    status: 'draft',
    ticket_price: 100,
    verification_pin: SCANNER_PIN,
    days: [
      { date_and_time: TODAY_NOON,    label: 'Day 1 (today)' },
      { date_and_time: TOMORROW_NOON, label: 'Day 2 (tomorrow)' },
    ],
  });

  if (status !== 201) {
    fail('Create 2-day event', `HTTP ${status} — ${JSON.stringify(data)}`);
    process.exit(1);
  }

  const eventId = data.event.id;
  createdEventIds.push(eventId);
  pass('Create 2-day event', `id=${eventId}`);

  // Fetch event to get day IDs
  const { data: fetched } = await api('GET', `/api/events/${eventId}`);
  const days = fetched?.event?.days ?? [];
  if (days.length !== 2) {
    fail('Event has 2 days', `got ${days.length}`);
    process.exit(1);
  }

  const dayToday    = days.find(d => d.label === 'Day 1 (today)');
  const dayTomorrow = days.find(d => d.label === 'Day 2 (tomorrow)');
  pass('Event days created', `today_id=${dayToday.id} tomorrow_id=${dayTomorrow.id}`);

  // Create ticket type valid on ALL days
  const { data: ttAll } = await api('POST', '/api/events/ticket-types', {
    event_id: eventId, name: 'All Days', price: 100, max_tickets: 10,
  });
  // Create ticket type valid on tomorrow ONLY
  const { data: ttTomorrow } = await api('POST', '/api/events/ticket-types', {
    event_id: eventId, name: 'Tomorrow Only', price: 100, max_tickets: 10,
    day_ids: [dayTomorrow.id],
  });

  pass('Ticket types created',
    `all_days_id=${ttAll?.ticketType?.id} tomorrow_only_id=${ttTomorrow?.ticketType?.id}`
  );

  // Add a confirmed ticket for "All Days" type with 3 entries
  const { data: ticketAllDays } = await api('POST', '/api/events/tickets', {
    event_id: eventId,
    ticket_type_id: ttAll?.ticketType?.id,
    name: 'Test Attendee All',
    email_address: 'test-all@example.com',
    contact_number: '09000000001',
    number_of_entries: 3,
    ticket_paid: true,
    send_email: false,
  });

  // Add a confirmed ticket for "Tomorrow Only" type
  const { data: ticketTomorrow } = await api('POST', '/api/events/tickets', {
    event_id: eventId,
    ticket_type_id: ttTomorrow?.ticketType?.id,
    name: 'Test Attendee Tomorrow',
    email_address: 'test-tomorrow@example.com',
    contact_number: '09000000002',
    number_of_entries: 2,
    ticket_paid: true,
    send_email: false,
  });

  const allDaysTicketId    = ticketAllDays?.ticket?.id;
  const tomorrowTicketId   = ticketTomorrow?.ticket?.id;
  const allDaysTicketCode  = ticketAllDays?.ticket?.ticket_code;
  const tomorrowTicketCode = ticketTomorrow?.ticket?.ticket_code;

  if (!allDaysTicketCode || !tomorrowTicketCode) {
    fail('Tickets created', `all=${allDaysTicketCode} tomorrow=${tomorrowTicketCode} — ${JSON.stringify(ticketAllDays)}`);
    process.exit(1);
  }
  pass('Confirmed tickets created', `all_days=${allDaysTicketCode} tomorrow_only=${tomorrowTicketCode}`);

  // Resend tickets — this sets status to 'Ticket sent.' which the scanner requires
  const { status: resendStatus, data: resendData } = await api('POST', '/api/events/tickets/resend', {
    ticket_ids: [allDaysTicketId, tomorrowTicketId],
  });
  if (resendStatus !== 200) console.log(`    [resend detail] ${JSON.stringify(resendData)}`);
  check('Tickets set to Ticket sent. status', resendStatus === 200, `HTTP ${resendStatus}`);

  return { eventId, dayToday, dayTomorrow, allDaysTicketCode, tomorrowTicketCode };
}

// ─── Scanner Tests ────────────────────────────────────────────────────────────

async function testScannerLogin(eventId, dayToday, dayTomorrow) {
  section('1. Scanner Login');

  const { status, data } = await api('POST', '/api/scanner/login', {
    event_id: eventId, pin: SCANNER_PIN,
  });
  check('1a. Scanner login succeeds', status === 200, `HTTP ${status}`);
  if (status !== 200) { fail('Cannot continue scanner tests'); process.exit(1); }

  scannerToken = data?.token;
  check('1b. Scanner token received', !!scannerToken);

  const days = data?.event?.days ?? [];
  check('1c. Event days returned in login response', days.length === 2, `days=${days.length}`);
  check('1d. Days include today and tomorrow',
    days.some(d => d.id === dayToday.id) && days.some(d => d.id === dayTomorrow.id)
  );
}

async function testGetTicket(allDaysTicketCode, tomorrowTicketCode) {
  section('2. Scanner Get Ticket');

  // 2a. Ticket valid for today — should be accepted
  {
    const { status, data } = await api('POST', '/api/scanner/ticket', {
      ticket_code: allDaysTicketCode,
    }, { scanner: true });
    check('2a. All-days ticket accepted for today', status === 200, `HTTP ${status} — ${data?.error || ''}`);
    check('2a. Returns remaining_today', data?.ticket?.remaining_today !== undefined,
      `remaining_today=${data?.ticket?.remaining_today}`
    );
    check('2a. Returns current_event_day', !!data?.ticket?.current_event_day,
      `day=${data?.ticket?.current_event_day?.label}`
    );
    check('2a. no_matching_day is false', data?.ticket?.no_matching_day !== true);
  }

  // 2b. Ticket restricted to tomorrow — should be rejected today
  {
    const { status, data } = await api('POST', '/api/scanner/ticket', {
      ticket_code: tomorrowTicketCode,
    }, { scanner: true });
    check('2b. Tomorrow-only ticket rejected today', status === 403,
      `HTTP ${status} — ${data?.error || ''}`
    );
  }
}

async function testCheckIn(allDaysTicketCode) {
  section('3. Scanner Check-In');

  // 3a. Check in 1 entry from a 3-entry ticket — should succeed
  {
    const { status, data } = await api('POST', '/api/scanner/check-in', {
      ticket_code: allDaysTicketCode, entries_to_claim: 1,
    }, { scanner: true });
    check('3a. Check-in 1 entry succeeds', status === 200, `HTTP ${status} — ${data?.error || ''}`);
    check('3a. claimed_today = 1', data?.ticket?.claimed_today === 1, `claimed_today=${data?.ticket?.claimed_today}`);
    check('3a. remaining_today = 2', data?.ticket?.remaining_today === 2, `remaining_today=${data?.ticket?.remaining_today}`);
  }

  // 3b. Check in 1 more — running total
  {
    const { status, data } = await api('POST', '/api/scanner/check-in', {
      ticket_code: allDaysTicketCode, entries_to_claim: 1,
    }, { scanner: true });
    check('3b. Second check-in succeeds', status === 200, `HTTP ${status}`);
    check('3b. claimed_today = 2', data?.ticket?.claimed_today === 2, `claimed_today=${data?.ticket?.claimed_today}`);
    check('3b. remaining_today = 1', data?.ticket?.remaining_today === 1, `remaining_today=${data?.ticket?.remaining_today}`);
  }

  // 3c. Try to over-claim — request 2 but only 1 remaining
  {
    const { status, data } = await api('POST', '/api/scanner/check-in', {
      ticket_code: allDaysTicketCode, entries_to_claim: 2,
    }, { scanner: true });
    check('3c. Over-claim rejected', status === 400, `HTTP ${status}`);
    check('3c. Error message mentions remaining', data?.error?.includes('1') === true, `error="${data?.error}"`);
  }

  // 3d. Check in the last remaining entry — should succeed
  {
    const { status, data } = await api('POST', '/api/scanner/check-in', {
      ticket_code: allDaysTicketCode, entries_to_claim: 1,
    }, { scanner: true });
    check('3d. Final entry check-in succeeds', status === 200, `HTTP ${status}`);
    check('3d. remaining_today = 0', data?.ticket?.remaining_today === 0, `remaining_today=${data?.ticket?.remaining_today}`);
  }

  // 3e. Try to check in again — ticket fully used
  {
    const { status, data } = await api('POST', '/api/scanner/check-in', {
      ticket_code: allDaysTicketCode, entries_to_claim: 1,
    }, { scanner: true });
    check('3e. Fully-used ticket rejected', status === 400, `HTTP ${status}`);
  }

  // 3f. Verify scannerGetTicket also reflects the updated count
  {
    const { status, data } = await api('POST', '/api/scanner/ticket', {
      ticket_code: allDaysTicketCode,
    }, { scanner: true });
    check('3f. Get ticket reflects 0 remaining after full check-in',
      data?.ticket?.remaining_today === 0,
      `remaining_today=${data?.ticket?.remaining_today}`
    );
  }
}

async function testEventDayRemoval(eventId, dayToday, dayTomorrow) {
  section('4. Event Day Removal Guard');

  // 4a. Try to remove the day that has scan logs — should be blocked
  {
    const { data: fetched } = await api('GET', `/api/events/${eventId}`);
    const days = fetched?.event?.days ?? [];
    const keepDays = days.filter(d => d.id !== dayToday.id);

    const { status, data } = await api('PUT', `/api/events/${eventId}`, {
      days: keepDays.map(d => ({ id: d.id, date_and_time: d.date_and_time, label: d.label })),
    });
    check('4a. Removing scanned day is blocked', status === 400, `HTTP ${status}`);
    check('4a. Error mentions scan activity', data?.error?.toLowerCase().includes('scan'), `error="${data?.error}"`);

    // Confirm day was NOT removed
    const { data: after } = await api('GET', `/api/events/${eventId}`);
    const remainingDays = after?.event?.days ?? [];
    check('4a. Day count unchanged after blocked removal', remainingDays.length === 2, `days=${remainingDays.length}`);
  }

  // 4b. Remove the day with no scan logs (tomorrow) — should succeed
  {
    const { data: fetched } = await api('GET', `/api/events/${eventId}`);
    const days = fetched?.event?.days ?? [];
    const keepDays = days.filter(d => d.id !== dayTomorrow.id);

    const { status } = await api('PUT', `/api/events/${eventId}`, {
      days: keepDays.map(d => ({ id: d.id, date_and_time: d.date_and_time, label: d.label })),
    });
    check('4b. Removing clean day succeeds', status === 200, `HTTP ${status}`);

    const { data: after } = await api('GET', `/api/events/${eventId}`);
    const remainingDays = after?.event?.days ?? [];
    check('4b. Only 1 day remains after removal', remainingDays.length === 1, `days=${remainingDays.length}`);
    check('4b. Remaining day is the scanned one (today)', remainingDays[0]?.id === dayToday.id);
  }
}

// ─── Report ───────────────────────────────────────────────────────────────────

function printReport() {
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;

  console.log('\n' + '═'.repeat(64));
  console.log(' TEST REPORT');
  console.log('═'.repeat(64));
  console.log(`  Total:  ${results.length}`);
  console.log(`  Passed: ${passed} ✅`);
  console.log(`  Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log('═'.repeat(64));

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => !r.ok).forEach(r => {
      console.log(`  ❌ ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
    });
  }
  console.log('');
}

// ─── Main ────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\nScanner Multi-day Tests`);
  console.log(`API: ${BASE_URL}`);
  console.log(`User: ${USERNAME} (brand_id=${BRAND_ID})`);
  console.log(`Today UTC: ${todayUTC}\n`);

  await login();
  const { eventId, dayToday, dayTomorrow, allDaysTicketCode, tomorrowTicketCode } = await setupEvent();
  await testScannerLogin(eventId, dayToday, dayTomorrow);
  await testGetTicket(allDaysTicketCode, tomorrowTicketCode);
  await testCheckIn(allDaysTicketCode);
  await testEventDayRemoval(eventId, dayToday, dayTomorrow);

  printReport();
  process.exit(results.some(r => !r.ok) ? 1 : 0);
})();
