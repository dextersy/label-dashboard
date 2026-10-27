/**
 * Test script: Public API multi-day event support
 *
 * ⚠️  WARNING: Run against a development or staging environment only.
 * This script creates real events and tickets in the database and does not
 * clean them up afterwards. Do NOT run against production.
 *
 * Usage:
 *   node scripts/test-public-multiday.mjs [base_url] [username] [password]
 *
 * Or set env vars: TEST_USERNAME, TEST_PASSWORD, TEST_BRAND_ID (default: 1)
 *
 * What this tests:
 *   - GET /public/events/:id returns days array on event and ticket types
 *   - GET /public/events/:id/info returns days array
 *   - Single-day events return a single-item days array (backward compat)
 *   - Restricted ticket types show only their assigned days
 *   - All-days ticket types show all event days
 */

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const USERNAME = process.argv[3] || process.env.TEST_USERNAME;
const PASSWORD = process.argv[4] || process.env.TEST_PASSWORD;
const BRAND_ID = parseInt(process.env.TEST_BRAND_ID || '1', 10);

if (!USERNAME || !PASSWORD) {
  console.error('Usage: node test-public-multiday.mjs [base_url] <username> <password>');
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let adminToken = null;
const results = [];
const createdEventIds = [];

async function api(method, path, body, { useAdmin = false, ticketAccessToken = null, returnRaw = false } = {}) {
  const headers = { 'Content-Type': 'application/json', 'Origin': BASE_URL };
  if (useAdmin && adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
  if (ticketAccessToken) headers['Cookie'] = `ticket_access_token=${ticketAccessToken}`;
  const isGet = method === 'GET' || method === 'HEAD';
  const res = await fetch(`${BASE_URL}${path}`, {
    method, headers,
    body: (body && !isGet) ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = null; }
  if (returnRaw) {
    // Extract ticket_access_token from Set-Cookie header
    const setCookie = res.headers.get('set-cookie') || '';
    const match = setCookie.match(/ticket_access_token=([^;]+)/);
    const cookieToken = match ? match[1] : null;
    return { status: res.status, data, cookieToken };
  }
  return { status: res.status, data };
}

function pass(name, detail = '') { results.push({ name, ok: true }); console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`); }
function fail(name, detail = '') { results.push({ name, ok: false }); console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
function check(name, condition, detail = '') { condition ? pass(name, detail) : fail(name, detail); }
function section(title) { console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`); }

const DAY1 = '2099-06-01T10:00:00.000Z';
const DAY2 = '2099-06-02T10:00:00.000Z';
const DAY3 = '2099-06-03T10:00:00.000Z';

// ─── Auth & Setup ─────────────────────────────────────────────────────────────

async function login() {
  section('Auth');
  const { status, data } = await api('POST', '/api/auth/login', { username: USERNAME, password: PASSWORD, brand_id: BRAND_ID });
  if (status !== 200 || !data?.token) { fail('Admin login', `HTTP ${status}`); process.exit(1); }
  adminToken = data.token;
  pass('Admin login');
}

async function createAndPublishEvent(overrides = {}) {
  const { status, data } = await api('POST', '/api/events', {
    title: `[TEST] Public Multiday ${Date.now()}`,
    date_and_time: DAY1,
    venue: 'Test Venue',
    ticketing_enabled: true,
    status: 'draft',
    ticket_price: 100,
    ...overrides,
  }, { useAdmin: true });

  if (status !== 201) {
    console.log(`    [create detail] ${JSON.stringify(data)}`);
    return null;
  }
  const eventId = data.event.id;
  createdEventIds.push(eventId);

  // Publish so public endpoints can see it
  await api('POST', `/api/events/${eventId}/publish`, {}, { useAdmin: true });
  return eventId;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function testGetEventForPublic() {
  section('1. GET /public/events/:id');

  // ── 1a. Single-day event ──────────────────────────────────────────────────
  const singleDayId = await createAndPublishEvent();
  if (!singleDayId) { fail('1a. Setup: single-day event'); return; }
  pass('1a. Setup: single-day event created', `id=${singleDayId}`);

  {
    const { status, data } = await api('GET', `/api/public/events/${singleDayId}`);
    check('1a. GET single-day event succeeds', status === 200, `HTTP ${status}`);
    const days = data?.event?.days ?? data?.days ?? [];
    check('1a. days array present', Array.isArray(days), `type=${typeof days}`);
    check('1a. Single-day event has 1 day', days.length === 1, `days.length=${days.length}`);
    check('1a. Day has required fields', days[0]?.id && days[0]?.date_and_time && 'label' in days[0]);
  }

  // ── 1b. Multi-day event ───────────────────────────────────────────────────
  const multiDayId = await createAndPublishEvent({
    days: [
      { date_and_time: DAY1, label: 'Day 1' },
      { date_and_time: DAY2, label: 'Day 2' },
      { date_and_time: DAY3, label: 'Day 3' },
    ],
  });
  if (!multiDayId) { fail('1b. Setup: multi-day event'); return; }
  pass('1b. Setup: 3-day event created', `id=${multiDayId}`);

  let multiDayEventDays = [];
  {
    const { status, data } = await api('GET', `/api/public/events/${multiDayId}`);
    check('1b. GET multi-day event succeeds', status === 200, `HTTP ${status}`);
    const days = data?.event?.days ?? data?.days ?? [];
    check('1b. 3 days returned', days.length === 3, `days.length=${days.length}`);
    check('1b. Days sorted ascending',
      new Date(days[0]?.date_and_time) < new Date(days[1]?.date_and_time) &&
      new Date(days[1]?.date_and_time) < new Date(days[2]?.date_and_time)
    );
    check('1b. Day labels preserved', days.map(d => d.label).join(',') === 'Day 1,Day 2,Day 3');
    multiDayEventDays = days;
  }

  // ── 1c. Ticket types include their valid days ─────────────────────────────
  if (multiDayEventDays.length === 3) {
    // Create a day-restricted ticket type via admin
    await api('POST', '/api/events/ticket-types', {
      event_id: multiDayId,
      name: 'Day 1 Only',
      price: 200,
      max_tickets: 10,
      day_ids: [multiDayEventDays[0].id],
    }, { useAdmin: true });

    const { data } = await api('GET', `/api/public/events/${multiDayId}`);
    const ticketTypes = data?.event?.ticketTypes ?? [];
    const allDaysTT  = ticketTypes.find(t => t.name === 'Regular' || (t.days?.length === 3));
    const restrictedTT = ticketTypes.find(t => t.name === 'Day 1 Only');

    check('1c. Ticket types have days array',
      ticketTypes.every(t => Array.isArray(t.days)),
      `types=${ticketTypes.length}`
    );
    check('1c. All-days ticket type shows all 3 days',
      allDaysTT?.days?.length === 3,
      `days=${allDaysTT?.days?.length}`
    );
    check('1c. Restricted ticket type shows 1 day',
      restrictedTT?.days?.length === 1,
      `days=${restrictedTT?.days?.length}`
    );
    check('1c. Restricted type linked to correct day',
      restrictedTT?.days?.[0]?.id === multiDayEventDays[0].id
    );
  }
}

async function testGetPublicEventInfo() {
  section('2. GET /public/events/:id/info');

  // Single-day
  const singleId = await createAndPublishEvent();
  if (!singleId) { fail('2. Setup: single-day event'); return; }

  {
    const { status, data } = await api('GET', `/api/public/events/${singleId}/info`);
    check('2a. GET /info single-day succeeds', status === 200, `HTTP ${status}`);
    const days = data?.event?.days ?? [];
    check('2a. days array present on /info', Array.isArray(days));
    check('2a. Single-day /info has 1 day', days.length === 1, `days.length=${days.length}`);
  }

  // Multi-day
  const multiId = await createAndPublishEvent({
    days: [
      { date_and_time: DAY1, label: 'Opening' },
      { date_and_time: DAY2, label: 'Closing' },
    ],
  });
  if (!multiId) { fail('2b. Setup: multi-day event'); return; }

  {
    const { status, data } = await api('GET', `/api/public/events/${multiId}/info`);
    check('2b. GET /info multi-day succeeds', status === 200, `HTTP ${status}`);
    const days = data?.event?.days ?? [];
    check('2b. 2 days returned on /info', days.length === 2, `days.length=${days.length}`);
    check('2b. Labels preserved on /info',
      days.some(d => d.label === 'Opening') && days.some(d => d.label === 'Closing')
    );
  }
}

async function testGetTicketDetails() {
  section('3. POST /public/tickets/details');

  // Use a free multi-day event so we can buy a ticket publicly and get the JWT cookie
  const eventId = await createAndPublishEvent({
    ticket_price: 0,
    days: [
      { date_and_time: DAY1, label: 'Day 1' },
      { date_and_time: DAY2, label: 'Day 2' },
    ],
  });
  if (!eventId) { fail('3. Setup: free multi-day event'); return; }

  // Get ticket type id from public endpoint
  const { data: evData } = await api('GET', `/api/public/events/${eventId}`);
  const ttId = evData?.event?.ticketTypes?.[0]?.id;
  if (!ttId) { fail('3. Setup: ticket type from public event'); return; }

  // Buy a free ticket — the response sets ticket_access_token cookie
  const { status: buyStatus, data: buyData, cookieToken } = await api('POST', '/api/public/tickets/buy', {
    event_id: eventId,
    ticket_type_id: ttId,
    name: 'Details Test',
    email_address: 'details-test@example.com',
    contact_number: '09000000099',
    number_of_entries: 1,
  }, { returnRaw: true });

  check('3. Setup: free ticket bought', buyStatus === 200 || buyStatus === 201, `HTTP ${buyStatus} — ${buyData?.error || ''}`);
  if (!cookieToken) { fail('3. Setup: JWT cookie present in buy response'); return; }
  pass('3. Setup: JWT cookie received from buy response');

  // 3a. All-days ticket type: event.days=2, ticketType.days=2
  {
    const { status, data } = await api('POST', '/api/public/tickets/details', {}, { ticketAccessToken: cookieToken });
    check('3a. Get ticket details succeeds', status === 200, `HTTP ${status} — ${data?.error || ''}`);
    const eventDays = data?.ticket?.event?.days ?? [];
    check('3a. event.days has 2 entries', eventDays.length === 2, `event.days=${eventDays.length}`);
    check('3a. event.days fields present', eventDays[0]?.id && eventDays[0]?.date_and_time && 'label' in eventDays[0]);
    const ttDays = data?.ticket?.ticketType?.days ?? [];
    check('3a. ticketType.days present', Array.isArray(ttDays), `type=${typeof ttDays}`);
    check('3a. All-days ticket type shows both days', ttDays.length === 2, `ticketType.days=${ttDays.length}`);
  }

  // 3b. Day-restricted ticket type: create "Day 1 Only", buy it, confirm ticketType.days=1
  const allEventDays = (await api('GET', `/api/public/events/${eventId}`)).data?.event?.days ?? [];
  if (allEventDays.length === 2) {
    await api('POST', '/api/events/ticket-types', {
      event_id: eventId, name: 'Day 1 Only', price: 0, max_tickets: 50,
      day_ids: [allEventDays[0].id],
    }, { useAdmin: true });

    const { data: refreshed } = await api('GET', `/api/public/events/${eventId}`);
    const restrictedTT = refreshed?.event?.ticketTypes?.find(t => t.name === 'Day 1 Only');

    const { status: buyStatus2, data: buyData2, cookieToken: cookieToken2 } = await api('POST', '/api/public/tickets/buy', {
      event_id: eventId,
      ticket_type_id: restrictedTT?.id,
      name: 'Restricted Details Test',
      email_address: 'details-restricted@example.com',
      contact_number: '09000000098',
      number_of_entries: 1,
    }, { returnRaw: true });

    check('3b. Buy restricted ticket succeeds', buyStatus2 === 200 || buyStatus2 === 201, `HTTP ${buyStatus2}`);
    if (cookieToken2) {
      const { status, data } = await api('POST', '/api/public/tickets/details', {}, { ticketAccessToken: cookieToken2 });
      check('3b. Get restricted ticket details succeeds', status === 200, `HTTP ${status} — ${data?.error || ''}`);
      const ttDays2 = data?.ticket?.ticketType?.days ?? [];
      check('3b. Restricted ticket type shows 1 day', ttDays2.length === 1, `ticketType.days=${ttDays2.length}`);
      check('3b. Restricted day matches Day 1', ttDays2[0]?.id === allEventDays[0].id);
    } else {
      fail('3b. JWT cookie from restricted buy');
    }
  }
}

async function testBuyTicketDays() {
  section('4. POST /public/tickets/buy — days in email payload');

  // This tests that the buyTicket endpoint correctly assembles days for the email.
  // We can't inspect the email directly, but we can verify the endpoint succeeds
  // and returns a ticket for both single-day and multi-day events.

  // Single-day
  const singleId = await createAndPublishEvent({ ticket_price: 0 });
  if (!singleId) { fail('4a. Setup: free single-day event'); return; }

  const { data: evData } = await api('GET', `/api/public/events/${singleId}`);
  const ttId = evData?.event?.ticketTypes?.[0]?.id;

  {
    const { status, data } = await api('POST', '/api/public/tickets/buy', {
      event_id: singleId,
      ticket_type_id: ttId,
      name: 'Buy Test Single',
      email_address: 'buy-single@example.com',
      contact_number: '09000000010',
      number_of_entries: 1,
    });
    check('4a. Buy ticket on single-day event succeeds', status === 200 || status === 201, `HTTP ${status} — ${data?.error || ''}`);
  }

  // Multi-day
  const multiId = await createAndPublishEvent({
    ticket_price: 0,
    days: [
      { date_and_time: DAY1, label: 'Day 1' },
      { date_and_time: DAY2, label: 'Day 2' },
    ],
  });
  if (!multiId) { fail('4b. Setup: free multi-day event'); return; }

  const { data: evDataMulti } = await api('GET', `/api/public/events/${multiId}`);
  const ttIdMulti = evDataMulti?.event?.ticketTypes?.[0]?.id;
  const eventDays = evDataMulti?.event?.days ?? [];

  {
    const { status, data } = await api('POST', '/api/public/tickets/buy', {
      event_id: multiId,
      ticket_type_id: ttIdMulti,
      name: 'Buy Test Multi',
      email_address: 'buy-multi@example.com',
      contact_number: '09000000011',
      number_of_entries: 1,
    });
    check('4b. Buy ticket on multi-day event succeeds', status === 200 || status === 201, `HTTP ${status} — ${data?.error || ''}`);
  }

  // Day-restricted ticket type
  if (eventDays.length === 2) {
    await api('POST', '/api/events/ticket-types', {
      event_id: multiId, name: 'Day 1 Only', price: 0, max_tickets: 10,
      day_ids: [eventDays[0].id],
    }, { useAdmin: true });

    const { data: refreshed } = await api('GET', `/api/public/events/${multiId}`);
    const restrictedTT = refreshed?.event?.ticketTypes?.find(t => t.name === 'Day 1 Only');

    const { status, data } = await api('POST', '/api/public/tickets/buy', {
      event_id: multiId,
      ticket_type_id: restrictedTT?.id,
      name: 'Buy Test Restricted',
      email_address: 'buy-restricted@example.com',
      contact_number: '09000000012',
      number_of_entries: 1,
    });
    check('4c. Buy restricted-day ticket succeeds', status === 200 || status === 201, `HTTP ${status} — ${data?.error || ''}`);
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
    results.filter(r => !r.ok).forEach(r => console.log(`  ❌ ${r.name}`));
  }
  console.log('');
}

// ─── Main ────────────────────────────────────────────────────────────────────

(async () => {
  console.log(`\nPublic API Multi-day Tests`);
  console.log(`API: ${BASE_URL}`);
  console.log(`User: ${USERNAME} (brand_id=${BRAND_ID})\n`);

  await login();
  await testGetEventForPublic();
  await testGetPublicEventInfo();
  await testGetTicketDetails();
  await testBuyTicketDays();

  printReport();
  process.exit(results.some(r => !r.ok) ? 1 : 0);
})();
