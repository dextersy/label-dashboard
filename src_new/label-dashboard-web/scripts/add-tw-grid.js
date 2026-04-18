/**
 * Phase 4D: Add tw- grid/flex classes alongside Bootstrap grid classes.
 *
 * For each HTML file, finds Bootstrap grid class usages (row, col-*) and adds
 * the Tailwind tw-prefixed equivalent alongside (without removing Bootstrap classes).
 *
 * Run from project root: node scripts/add-tw-grid.js
 */

const fs = require('fs');
const path = require('path');

// Bootstrap grid → Tailwind class mapping
// Key: Bootstrap class, Value: Tailwind tw- equivalent
const GRID_MAPPING = {
  // Row
  'row': ['tw-grid', 'tw-grid-cols-1'],

  // col (plain, no breakpoint)
  'col-1':  'tw-col-span-1',
  'col-2':  'tw-col-span-2',
  'col-3':  'tw-col-span-3',
  'col-4':  'tw-col-span-4',
  'col-6':  'tw-col-span-6',
  'col-8':  'tw-col-span-8',
  'col-12': 'tw-col-span-12',

  // col-sm-*
  'col-sm-6':  'tw-sm:tw-col-span-6',
  'col-sm-12': 'tw-sm:tw-col-span-12',

  // col-md-*
  'col-md-4':  'tw-md:tw-col-span-4',
  'col-md-6':  'tw-md:tw-col-span-6',
  'col-md-8':  'tw-md:tw-col-span-8',
  'col-md-12': 'tw-md:tw-col-span-12',

  // col-lg-*
  'col-lg-3':  'tw-lg:tw-col-span-3',
  'col-lg-4':  'tw-lg:tw-col-span-4',
  'col-lg-6':  'tw-lg:tw-col-span-6',
  'col-lg-8':  'tw-lg:tw-col-span-8',
  'col-lg-9':  'tw-lg:tw-col-span-9',
  'col-lg-12': 'tw-lg:tw-col-span-12',

  // col-xl-*
  'col-xl-3':  'tw-xl:tw-col-span-3',
  'col-xl-4':  'tw-xl:tw-col-span-4',
  'col-xl-6':  'tw-xl:tw-col-span-6',
  'col-xl-8':  'tw-xl:tw-col-span-8',
  'col-xl-12': 'tw-xl:tw-col-span-12',
};

// Pre-build the set of all Bootstrap grid class keys for quick lookup
const GRID_CLASS_KEYS = new Set(Object.keys(GRID_MAPPING));

/**
 * The Bootstrap col class names that must be matched as whole words.
 * We need word-boundary matching so e.g. "col-6" doesn't match "col-60".
 *
 * Strategy: after splitting on whitespace, compare tokens exactly against
 * the mapping keys. This gives us automatic word-boundary safety.
 */

/**
 * Given a class string from a static class="..." attribute, add tw- grid
 * equivalents for any Bootstrap grid classes found.
 * Does NOT remove existing classes; only appends missing tw- equivalents.
 */
function addTwGridClasses(classStr) {
  const classes = classStr.trim().split(/\s+/).filter(Boolean);
  const classSet = new Set(classes);
  const toAdd = [];

  for (const cls of classes) {
    if (!GRID_CLASS_KEYS.has(cls)) continue;

    const twEquiv = GRID_MAPPING[cls];

    if (Array.isArray(twEquiv)) {
      // e.g. 'row' maps to ['tw-grid', 'tw-grid-cols-1']
      for (const tw of twEquiv) {
        if (!classSet.has(tw)) {
          toAdd.push(tw);
          classSet.add(tw);
        }
      }
    } else {
      if (!classSet.has(twEquiv)) {
        toAdd.push(twEquiv);
        classSet.add(twEquiv);
      }
    }
  }

  if (toAdd.length === 0) return classStr;
  return classStr + ' ' + toAdd.join(' ');
}

/**
 * Process an HTML string: find all static class="..." attributes and add
 * tw- grid equivalents. Skips Angular bindings like [class.row]="..." or
 * [ngClass]="...".
 */
function processHtml(html) {
  // Negative lookbehind (?<!\[) ensures we skip Angular property bindings
  return html.replace(/(?<!\[)class="([^"]*)"/g, (match, classStr) => {
    const updated = addTwGridClasses(classStr);
    return `class="${updated}"`;
  });
}

/**
 * Recursively find all .html files under a directory.
 */
function findHtmlFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

// Main
const appDir = path.join(__dirname, '../src/app');
const files = findHtmlFiles(appDir);

let filesChanged = 0;
let filesSkipped = 0;

for (const filePath of files) {
  try {
    const original = fs.readFileSync(filePath, 'utf8');
    const updated = processHtml(original);

    if (updated !== original) {
      fs.writeFileSync(filePath, updated, 'utf8');
      console.log(`UPDATED: ${path.relative(appDir, filePath)}`);
      filesChanged++;
    } else {
      filesSkipped++;
    }
  } catch (err) {
    console.error(`ERROR: ${filePath}: ${err.message}`);
  }
}

console.log(`\nDone. Updated: ${filesChanged} files, Skipped: ${filesSkipped} files.`);
