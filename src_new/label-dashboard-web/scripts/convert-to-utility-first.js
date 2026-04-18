/**
 * Option B: Utility-first template conversion script
 *
 * Phase 1 (already run):
 *   .card / .card-header / .card-body / .card-footer
 *   .form-group → tw-mb-5
 *   .alert.* → inline tw- color classes
 *   .btn (standalone) + btn-block
 *   text-muted / text-center duplicates removed
 *
 * Phase 2 (this run):
 *   Spacing utilities (mb-, mt-, ms-, me-, p-, px-, py-, etc.)
 *   Text utilities (text-muted, text-success, text-end, etc.)
 *   Font weight (fw-bold, fw-semibold, etc.)
 *   Flex utilities (align-items-*, justify-content-*, flex-column, etc.)
 *   Form label (form-label → tw-label)
 *   Width/height (w-100, h-100)
 *   Display (d-flex, d-none, d-block, d-grid)
 *   Dedup pass (remove duplicate class tokens)
 *
 * Usage:  node scripts/convert-to-utility-first.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const DRY_RUN = process.argv.includes('--dry-run');

// ------------------------------------------------------------------ //
// Tailwind equivalents — Phase 1 constants                            //
// ------------------------------------------------------------------ //

const CARD_TW      = 'tw-bg-white tw-rounded-card tw-shadow-card tw-overflow-hidden tw-mb-8';
const CARD_HDR_TW  = 'tw-px-card-pad tw-pt-card-pad tw-pb-4';
const CARD_BODY_TW = 'tw-px-card-pad tw-pb-card-pad';
const CARD_FTR_TW  = 'tw-px-card-pad tw-py-4 tw-border-t tw-border-border-subtle';

const ALERT_BASE    = 'tw-px-4 tw-py-3 tw-mb-4 tw-border tw-rounded-lg tw-text-sm tw-leading-normal';
const ALERT_DANGER  = ALERT_BASE + ' tw-border-red-200 tw-bg-red-50 tw-text-red-800';
const ALERT_SUCCESS = ALERT_BASE + ' tw-border-green-200 tw-bg-green-50 tw-text-green-800';
const ALERT_WARNING = ALERT_BASE + ' tw-border-amber-200 tw-bg-amber-50 tw-text-amber-800';
const ALERT_INFO    = ALERT_BASE + ' tw-border-blue-200 tw-bg-blue-50 tw-text-blue-800';

// ------------------------------------------------------------------ //
// Helpers                                                              //
// ------------------------------------------------------------------ //

/**
 * Replace a class token inside class="..." or class='...' attributes.
 * Uses negative lookbehind/lookahead to treat hyphens as part of class
 * names — prevents matching "card" inside "tw-rounded-card".
 */
function replaceClass(html, from, to) {
  const escaped = from.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  const re = new RegExp(`(class=["'][^"']*?)(?<![\\w-])${escaped}(?![\\w-])([^"']*?["'])`, 'g');
  let count = 0;
  const result = html.replace(re, (match, prefix, suffix) => {
    count++;
    return prefix + to + suffix;
  });
  return { html: result, count };
}

/**
 * Run a batch of [from, to] replacements, collecting change summaries.
 * Returns { html, changes } where changes is an array of label strings.
 */
function batchReplace(html, pairs) {
  const changes = [];
  for (const [from, to, label] of pairs) {
    const r = replaceClass(html, from, to);
    if (r.count) {
      changes.push(`${label || from} ×${r.count}`);
      html = r.html;
    }
  }
  return { html, changes };
}

/**
 * Remove duplicate class tokens and normalize whitespace in all static
 * class="..." attributes. Skips attributes containing Angular {{ }}.
 * Returns { html, count } where count is total classes removed.
 */
function dedupClassAttributes(html) {
  let count = 0;
  const result = html.replace(/class=["'][^"']*["']/g, (match) => {
    const q = match[6]; // quote char: " or '
    const classStr = match.slice(7, -1);
    if (classStr.includes('{') || classStr.includes('}')) return match;
    const tokens = classStr.trim().split(/\s+/).filter(Boolean);
    const seen = new Set();
    const unique = [];
    for (const t of tokens) {
      if (!seen.has(t)) { seen.add(t); unique.push(t); }
    }
    const cleaned = unique.join(' ');
    // Return cleaned version if either duplicates were found OR whitespace changed
    if (unique.length === tokens.length && cleaned === classStr) return match;
    count += tokens.length - unique.length;
    return `class=${q}${cleaned}${q}`;
  });
  return { html: result, count };
}

// ------------------------------------------------------------------ //
// Phase 2 mapping tables                                              //
// ------------------------------------------------------------------ //

// Bootstrap spacing prefix → Tailwind prefix
// (logical Bootstrap props ms/me/ps/pe → physical Tailwind ml/mr/pl/pr)
const SPACING_MAP = [
  ['mb',  'tw-mb'], ['mt',  'tw-mt'],
  ['ms',  'tw-ml'], ['me',  'tw-mr'],
  ['pb',  'tw-pb'], ['pt',  'tw-pt'],
  ['ps',  'tw-pl'], ['pe',  'tw-pr'],
  ['px',  'tw-px'], ['py',  'tw-py'],
  ['mx',  'tw-mx'], ['my',  'tw-my'],
  ['gap', 'tw-gap'],
  ['p',   'tw-p'],  // must come after px/py/ps/pe
  ['m',   'tw-m'],  // must come after mb/mt/ms/me/mx/my
];
const SPACING_SIZES = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
  '14', '16', '20', '24', '28', '32', 'auto',
];

// Build spacing pairs: ['mb-3', 'tw-mb-3', 'mb-3']
function buildSpacingPairs() {
  const pairs = [];
  for (const [bs, tw] of SPACING_MAP) {
    for (const size of SPACING_SIZES) {
      pairs.push([`${bs}-${size}`, `${tw}-${size}`, `${bs}-${size}`]);
    }
  }
  return pairs;
}

// Text / color utilities
const TEXT_PAIRS = [
  ['text-muted',   'tw-text-muted',        'text-muted'],
  ['text-success', 'tw-text-success',      'text-success'],
  ['text-danger',  'tw-text-danger',       'text-danger'],
  ['text-warning', 'tw-text-warning',      'text-warning'],
  ['text-info',    'tw-text-[#0891b2]',    'text-info'],
  ['text-white',   'tw-text-white',        'text-white'],
  ['text-end',     'tw-text-right',        'text-end'],
  ['text-start',   'tw-text-left',         'text-start'],
  // text-center already handled as duplicate; convert remaining standalone ones
  ['text-center',  'tw-text-center',       'text-center→tw'],
];

// Font weight / style
const FONT_PAIRS = [
  ['fw-bold',      'tw-font-bold',         'fw-bold'],
  ['fw-semibold',  'tw-font-semibold',     'fw-semibold'],
  ['fw-medium',    'tw-font-medium',       'fw-medium'],
  ['fw-light',     'tw-font-light',        'fw-light'],
  ['fw-normal',    'tw-font-normal',       'fw-normal'],
  ['fst-italic',   'tw-italic',            'fst-italic'],
];

// Flex utilities
const FLEX_PAIRS = [
  ['align-items-center',       'tw-items-center',     'align-items-center'],
  ['align-items-start',        'tw-items-start',      'align-items-start'],
  ['align-items-end',          'tw-items-end',        'align-items-end'],
  ['align-items-baseline',     'tw-items-baseline',   'align-items-baseline'],
  ['align-items-stretch',      'tw-items-stretch',    'align-items-stretch'],
  ['justify-content-between',  'tw-justify-between',  'justify-content-between'],
  ['justify-content-center',   'tw-justify-center',   'justify-content-center'],
  ['justify-content-end',      'tw-justify-end',      'justify-content-end'],
  ['justify-content-start',    'tw-justify-start',    'justify-content-start'],
  ['justify-content-around',   'tw-justify-around',   'justify-content-around'],
  ['justify-content-evenly',   'tw-justify-evenly',   'justify-content-evenly'],
  ['flex-column',              'tw-flex-col',         'flex-column'],
  ['flex-row',                 'tw-flex-row',         'flex-row'],
  ['flex-wrap',                'tw-flex-wrap',        'flex-wrap'],
  ['flex-nowrap',              'tw-flex-nowrap',      'flex-nowrap'],
  ['flex-fill',                'tw-flex-1',           'flex-fill'],
  ['flex-shrink-0',            'tw-shrink-0',         'flex-shrink-0'],
  ['flex-grow-1',              'tw-grow',             'flex-grow-1'],
];

// Display utilities
const DISPLAY_PAIRS = [
  ['d-flex',         'tw-flex',          'd-flex'],
  ['d-inline-flex',  'tw-inline-flex',   'd-inline-flex'],
  ['d-inline-block', 'tw-inline-block',  'd-inline-block'],
  ['d-inline',       'tw-inline',        'd-inline'],
  ['d-block',        'tw-block',         'd-block'],
  ['d-none',         'tw-hidden',        'd-none'],
  ['d-grid',         'tw-grid',          'd-grid'],
  ['d-table',        'tw-table',         'd-table'],
  // Responsive display (lg breakpoint)
  ['d-lg-flex',      'tw-lg:tw-flex',    'd-lg-flex'],
  ['d-lg-block',     'tw-lg:tw-block',   'd-lg-block'],
  ['d-lg-none',      'tw-lg:tw-hidden',  'd-lg-none'],
  ['d-md-flex',      'tw-md:tw-flex',    'd-md-flex'],
  ['d-md-block',     'tw-md:tw-block',   'd-md-block'],
  ['d-md-none',      'tw-md:tw-hidden',  'd-md-none'],
  ['d-sm-flex',      'tw-sm:tw-flex',    'd-sm-flex'],
  ['d-sm-none',      'tw-sm:tw-hidden',  'd-sm-none'],
];

// Width / height / sizing
const SIZING_PAIRS = [
  ['w-100',     'tw-w-full',        'w-100'],
  ['w-75',      'tw-w-3/4',         'w-75'],
  ['w-50',      'tw-w-1/2',         'w-50'],
  ['w-25',      'tw-w-1/4',         'w-25'],
  ['h-100',     'tw-h-full',        'h-100'],
  ['mw-100',    'tw-max-w-full',    'mw-100'],
  ['min-vh-100','tw-min-h-screen',  'min-vh-100'],
  ['vw-100',    'tw-w-screen',      'vw-100'],
  ['vh-100',    'tw-h-screen',      'vh-100'],
];

// Form components
// NOTE: longer variants must come BEFORE the base form-control
const FORM_PAIRS = [
  ['form-label',      'tw-label',    'form-label'],
  ['form-control-lg', 'tw-input-lg', 'form-control-lg'],
  ['form-control-sm', 'tw-input-sm', 'form-control-sm'],
  // form-control-md is a custom (non-Bootstrap) variant → treat as base tw-input
  ['form-control-md', '',            'form-control-md(remove)'],
  // Remove base form-control; tw-input stays; dedup handles duplicates
  ['form-control',    '',            'form-control(remove)'],
];

// Background utilities
const BG_PAIRS = [
  ['bg-white',       'tw-bg-white',       'bg-white'],
  ['bg-light',       'tw-bg-gray-50',     'bg-light'],
  ['bg-transparent', 'tw-bg-transparent', 'bg-transparent'],
];

// Border / position utilities
const MISC_PAIRS = [
  ['border-0',          'tw-border-0',       'border-0'],
  ['rounded-circle',    'tw-rounded-full',   'rounded-circle'],
  ['position-relative', 'tw-relative',       'position-relative'],
  ['position-absolute', 'tw-absolute',       'position-absolute'],
  ['position-fixed',    'tw-fixed',          'position-fixed'],
  ['overflow-hidden',   'tw-overflow-hidden','overflow-hidden'],
  ['overflow-auto',     'tw-overflow-auto',  'overflow-auto'],
  ['float-end',         'tw-float-right',    'float-end'],
  ['float-start',       'tw-float-left',     'float-start'],
  ['float-none',        'tw-float-none',     'float-none'],
  ['visibility-hidden', 'tw-invisible',      'visibility-hidden'],
  ['invisible',         'tw-invisible',      'invisible'],
  ['visible',           'tw-visible',        'visible'],
];

// ------------------------------------------------------------------ //
// Per-file transformation                                              //
// ------------------------------------------------------------------ //

function transformFile(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  const original = html;
  const allChanges = [];

  // ===== PHASE 1: Semantic Bootstrap components ===================== //

  // ALERTS (modifiers before base)
  let r;
  r = replaceClass(html, 'alert-danger',  'tw-border-red-200 tw-bg-red-50 tw-text-red-800');
  if (r.count) { allChanges.push(`alert-danger ×${r.count}`); html = r.html; }

  r = replaceClass(html, 'alert-error',   'tw-border-red-200 tw-bg-red-50 tw-text-red-800');
  if (r.count) { allChanges.push(`alert-error ×${r.count}`); html = r.html; }

  r = replaceClass(html, 'alert-success', 'tw-border-green-200 tw-bg-green-50 tw-text-green-800');
  if (r.count) { allChanges.push(`alert-success ×${r.count}`); html = r.html; }

  r = replaceClass(html, 'alert-warning', 'tw-border-amber-200 tw-bg-amber-50 tw-text-amber-800');
  if (r.count) { allChanges.push(`alert-warning ×${r.count}`); html = r.html; }

  r = replaceClass(html, 'alert-info',    'tw-border-blue-200 tw-bg-blue-50 tw-text-blue-800');
  if (r.count) { allChanges.push(`alert-info ×${r.count}`); html = r.html; }

  r = replaceClass(html, 'alert', ALERT_BASE);
  if (r.count) { allChanges.push(`alert ×${r.count}`); html = r.html; }

  // CARD (parts before base)
  r = replaceClass(html, 'card-header', CARD_HDR_TW);
  if (r.count) { allChanges.push(`card-header ×${r.count}`); html = r.html; }

  r = replaceClass(html, 'card-body',   CARD_BODY_TW);
  if (r.count) { allChanges.push(`card-body ×${r.count}`); html = r.html; }

  r = replaceClass(html, 'card-footer', CARD_FTR_TW);
  if (r.count) { allChanges.push(`card-footer ×${r.count}`); html = r.html; }

  r = replaceClass(html, 'card',        CARD_TW);
  if (r.count) { allChanges.push(`card ×${r.count}`); html = r.html; }

  // FORM GROUP
  r = replaceClass(html, 'form-group', 'tw-mb-5');
  if (r.count) { allChanges.push(`form-group ×${r.count}`); html = r.html; }

  // BTN-BLOCK → tw-w-full
  r = replaceClass(html, 'btn-block', 'tw-w-full');
  if (r.count) { allChanges.push(`btn-block ×${r.count}`); html = r.html; }

  // Standalone btn base class (whole-word match won't touch btn-primary etc.)
  r = replaceClass(html, 'btn', '');
  if (r.count) {
    allChanges.push(`btn-base ×${r.count}`);
    html = r.html;
  }

  // ===== PHASE 2: Utility class conversion ========================= //

  // Spacing (mb, mt, ms, me, p, px, py, pt, pb, ps, pe, m, mx, my, gap)
  const spacingPairs = buildSpacingPairs();
  const sRes = batchReplace(html, spacingPairs);
  if (sRes.changes.length) {
    allChanges.push(...sRes.changes);
    html = sRes.html;
  }

  // Text utilities
  const tRes = batchReplace(html, TEXT_PAIRS);
  if (tRes.changes.length) { allChanges.push(...tRes.changes); html = tRes.html; }

  // Font weight
  const fRes = batchReplace(html, FONT_PAIRS);
  if (fRes.changes.length) { allChanges.push(...fRes.changes); html = fRes.html; }

  // Flex utilities
  const flRes = batchReplace(html, FLEX_PAIRS);
  if (flRes.changes.length) { allChanges.push(...flRes.changes); html = flRes.html; }

  // Display utilities
  const dRes = batchReplace(html, DISPLAY_PAIRS);
  if (dRes.changes.length) { allChanges.push(...dRes.changes); html = dRes.html; }

  // Sizing
  const szRes = batchReplace(html, SIZING_PAIRS);
  if (szRes.changes.length) { allChanges.push(...szRes.changes); html = szRes.html; }

  // Form components
  const foRes = batchReplace(html, FORM_PAIRS);
  if (foRes.changes.length) { allChanges.push(...foRes.changes); html = foRes.html; }

  // Background utilities
  const bgRes = batchReplace(html, BG_PAIRS);
  if (bgRes.changes.length) { allChanges.push(...bgRes.changes); html = bgRes.html; }

  // Misc utilities
  const mRes = batchReplace(html, MISC_PAIRS);
  if (mRes.changes.length) { allChanges.push(...mRes.changes); html = mRes.html; }

  // ===== DEDUP + WHITESPACE: normalize all static class attributes === //
  // Removes duplicate tokens and trims/collapses whitespace.
  // e.g. "mb-3 tw-mb-3" → "tw-mb-3", " form-control-sm" → "form-control-sm"
  const dedup = dedupClassAttributes(html);
  if (dedup.html !== html) {
    if (dedup.count) allChanges.push(`dedup ×${dedup.count}`);
    else allChanges.push(`whitespace-fix`);
    html = dedup.html;
  }

  // ===== PHASE 3: Angular binding fixes ============================ //
  // Convert [class.text-X]="..." → [class.tw-text-X]="..." (property bindings)
  // and 'text-X' → 'tw-text-X' inside JS expression attributes ([class], [ngClass])
  const ANGULAR_ATTR_FIXES = [
    ['[class.text-danger]',  '[class.tw-text-danger]'],
    ['[class.text-success]', '[class.tw-text-success]'],
    ['[class.text-warning]', '[class.tw-text-warning]'],
    ['[class.text-muted]',   '[class.tw-text-muted]'],
    ['[class.text-info]',    '[class.tw-text-info]'],
    ['[class.text-white]',   '[class.tw-text-white]'],
  ];
  for (const [from, to] of ANGULAR_ATTR_FIXES) {
    if (html.includes(from)) {
      const count = (html.split(from).length - 1);
      html = html.replaceAll(from, to);
      allChanges.push(`${from}→${to} ×${count}`);
    }
  }

  // Replace single-quoted class name strings inside JS expressions
  // These appear in [class]="... 'text-danger' ..." and [ngClass]="{'text-danger': ...}"
  const JS_CLASS_FIXES = [
    ["'text-danger'",  "'tw-text-danger'"],
    ["'text-success'", "'tw-text-success'"],
    ["'text-warning'", "'tw-text-warning'"],
    ["'text-muted'",   "'tw-text-muted'"],
    ["'text-info'",    "'tw-text-info'"],
    ["'text-white'",   "'tw-text-white'"],
  ];
  for (const [from, to] of JS_CLASS_FIXES) {
    if (html.includes(from)) {
      const count = (html.split(from).length - 1);
      html = html.replaceAll(from, to);
      allChanges.push(`${from}→${to} ×${count}`);
    }
  }

  // ---------------------------------------------------------------- //
  if (allChanges.length === 0) return { changed: false };

  const shortPath = filePath.replace(/.*src\/app\//, 'src/app/');
  if (!DRY_RUN) {
    fs.writeFileSync(filePath, html, 'utf8');
  }

  return { changed: true, changes: allChanges, shortPath };
}

// ------------------------------------------------------------------ //
// Main                                                                 //
// ------------------------------------------------------------------ //

const srcDir = path.join(__dirname, '../src/app');
const files = glob.sync('**/*.html', { cwd: srcDir, absolute: true });

console.log(`\n🔄 Option B template conversion — Phase 2${DRY_RUN ? ' (DRY RUN)' : ''}`);
console.log(`   Scanning ${files.length} HTML files...\n`);

let totalChanged = 0;

for (const file of files) {
  const result = transformFile(file);
  if (result.changed) {
    totalChanged++;
    console.log(`  ✓ ${result.shortPath}`);
    // Summarize changes (collapse spacing into one line to reduce noise)
    const spacingChanges = result.changes.filter(c => /^(mb|mt|ms|me|p[xytb]?|m[xy]|gap|ps|pe)-/.test(c.split(' ')[0]));
    const otherChanges   = result.changes.filter(c => !/^(mb|mt|ms|me|p[xytb]?|m[xy]|gap|ps|pe)-/.test(c.split(' ')[0]));
    if (spacingChanges.length) {
      const total = spacingChanges.reduce((sum, c) => sum + parseInt(c.match(/×(\d+)/)?.[1] || 0), 0);
      console.log(`      spacing ×${total} (${spacingChanges.length} variants)`);
    }
    for (const c of otherChanges) {
      console.log(`      ${c}`);
    }
  }
}

console.log(`\n✅ Done. ${totalChanged} files ${DRY_RUN ? 'would be ' : ''}updated.\n`);

if (DRY_RUN) {
  console.log('Run without --dry-run to apply changes.\n');
}
