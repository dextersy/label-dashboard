/**
 * Phase 3: Add tw- utility classes alongside Bootstrap utility classes.
 *
 * For each HTML file, finds Bootstrap utility class usages and adds the
 * Tailwind tw-prefixed equivalent alongside (without removing Bootstrap classes).
 *
 * Run from project root: node scripts/add-tw-classes.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Bootstrap → Tailwind class mapping (only utility classes, not semantic component classes)
const MAPPING = {
  // Display
  'd-flex': 'tw-flex',
  'd-block': 'tw-block',
  'd-none': 'tw-hidden',
  'd-inline': 'tw-inline',
  'd-inline-flex': 'tw-inline-flex',
  'd-inline-block': 'tw-inline-block',
  // Responsive display
  'd-sm-flex': 'tw-sm:tw-flex',
  'd-sm-none': 'tw-sm:tw-hidden',
  'd-sm-block': 'tw-sm:tw-block',
  'd-md-flex': 'tw-md:tw-flex',
  'd-md-none': 'tw-md:tw-hidden',
  'd-md-block': 'tw-md:tw-block',
  'd-lg-flex': 'tw-lg:tw-flex',
  'd-lg-none': 'tw-lg:tw-hidden',
  'd-lg-block': 'tw-lg:tw-block',
  'd-xl-flex': 'tw-xl:tw-flex',
  'd-xl-none': 'tw-xl:tw-hidden',
  // Flex direction
  'flex-column': 'tw-flex-col',
  'flex-row': 'tw-flex-row',
  'flex-wrap': 'tw-flex-wrap',
  'flex-nowrap': 'tw-flex-nowrap',
  'flex-shrink-0': 'tw-shrink-0',
  'flex-grow-1': 'tw-flex-grow',
  // Align items
  'align-items-center': 'tw-items-center',
  'align-items-start': 'tw-items-start',
  'align-items-end': 'tw-items-end',
  'align-items-stretch': 'tw-items-stretch',
  'align-items-baseline': 'tw-items-baseline',
  // Justify content
  'justify-content-between': 'tw-justify-between',
  'justify-content-center': 'tw-justify-center',
  'justify-content-end': 'tw-justify-end',
  'justify-content-start': 'tw-justify-start',
  'justify-content-around': 'tw-justify-around',
  'justify-content-evenly': 'tw-justify-evenly',
  // Margin
  'mb-0': 'tw-mb-0',
  'mb-1': 'tw-mb-1',
  'mb-2': 'tw-mb-2',
  'mb-3': 'tw-mb-3',
  'mb-4': 'tw-mb-4',
  'mb-5': 'tw-mb-5',
  'mt-0': 'tw-mt-0',
  'mt-1': 'tw-mt-1',
  'mt-2': 'tw-mt-2',
  'mt-3': 'tw-mt-3',
  'mt-4': 'tw-mt-4',
  'mt-5': 'tw-mt-5',
  'ms-0': 'tw-ml-0',
  'ms-1': 'tw-ml-1',
  'ms-2': 'tw-ml-2',
  'ms-3': 'tw-ml-3',
  'me-0': 'tw-mr-0',
  'me-1': 'tw-mr-1',
  'me-2': 'tw-mr-2',
  'me-3': 'tw-mr-3',
  'mx-0': 'tw-mx-0',
  'mx-auto': 'tw-mx-auto',
  'my-0': 'tw-my-0',
  'my-1': 'tw-my-1',
  'my-2': 'tw-my-2',
  'my-3': 'tw-my-3',
  'my-4': 'tw-my-4',
  'my-auto': 'tw-my-auto',
  // Padding
  'p-0': 'tw-p-0',
  'p-1': 'tw-p-1',
  'p-2': 'tw-p-2',
  'p-3': 'tw-p-3',
  'p-4': 'tw-p-4',
  'px-0': 'tw-px-0',
  'px-1': 'tw-px-1',
  'px-2': 'tw-px-2',
  'px-3': 'tw-px-3',
  'px-4': 'tw-px-4',
  'py-0': 'tw-py-0',
  'py-1': 'tw-py-1',
  'py-2': 'tw-py-2',
  'py-3': 'tw-py-3',
  'py-4': 'tw-py-4',
  'ps-0': 'tw-pl-0',
  'ps-1': 'tw-pl-1',
  'pe-0': 'tw-pr-0',
  'pe-1': 'tw-pr-1',
  'pt-0': 'tw-pt-0',
  'pt-1': 'tw-pt-1',
  'pt-2': 'tw-pt-2',
  'pt-3': 'tw-pt-3',
  'pt-4': 'tw-pt-4',
  'pb-0': 'tw-pb-0',
  'pb-1': 'tw-pb-1',
  'pb-2': 'tw-pb-2',
  'pb-3': 'tw-pb-3',
  'pb-4': 'tw-pb-4',
  // Text
  'text-center': 'tw-text-center',
  'text-end': 'tw-text-right',
  'text-start': 'tw-text-left',
  'text-muted': 'tw-text-muted',
  'text-danger': 'tw-text-danger',
  'text-success': 'tw-text-success',
  'text-warning': 'tw-text-warning',
  'text-white': 'tw-text-white',
  'text-dark': 'tw-text-gray-900',
  'text-secondary': 'tw-text-gray-500',
  'small': 'tw-text-sm',
  'fw-bold': 'tw-font-bold',
  'fw-semibold': 'tw-font-semibold',
  'fw-normal': 'tw-font-normal',
  'fst-italic': 'tw-italic',
  // Width / Height
  'w-100': 'tw-w-full',
  'w-50': 'tw-w-1/2',
  'h-100': 'tw-h-full',
  'min-vh-100': 'tw-min-h-screen',
  // Gap
  'gap-0': 'tw-gap-0',
  'gap-1': 'tw-gap-1',
  'gap-2': 'tw-gap-2',
  'gap-3': 'tw-gap-3',
  'gap-4': 'tw-gap-4',
  // Background
  'bg-white': 'tw-bg-white',
  'bg-light': 'tw-bg-gray-50',
  'bg-transparent': 'tw-bg-transparent',
  // Border
  'border-0': 'tw-border-0',
  // Overflow
  'overflow-auto': 'tw-overflow-auto',
  'overflow-hidden': 'tw-overflow-hidden',
  // Form controls (Phase 4C)
  'form-control': 'tw-input',
  'form-label': 'tw-label',
  'form-select': 'tw-input',    // select uses same base styling
};

// Classes that look like utility classes but should NOT be auto-mapped
// (they are semantic component classes or have no direct equivalent)
const SKIP_CLASSES = new Set([
  'btn', 'card', 'form-control', 'table', 'modal', 'badge', 'alert',
  'navbar', 'nav', 'list-group', 'input-group', 'dropdown', 'pagination',
  'progress', 'breadcrumb', 'accordion', 'collapse', 'tab', 'toast',
  'row', 'col', 'container', 'form-check', 'form-group', 'form-label',
  'form-select', 'form-text', 'form-floating',
  // Partial class names that will be matched by substring - add prefix only
]);

/**
 * Given a class string, add tw- equivalents for any Bootstrap utility classes found.
 * Does NOT remove existing classes, only adds tw- equivalents if not already present.
 */
function addTwClasses(classStr) {
  const classes = classStr.trim().split(/\s+/).filter(Boolean);
  const classSet = new Set(classes);
  const toAdd = [];

  for (const cls of classes) {
    const twEquiv = MAPPING[cls];
    if (twEquiv && !classSet.has(twEquiv)) {
      toAdd.push(twEquiv);
      classSet.add(twEquiv);
    }
  }

  if (toAdd.length === 0) return classStr;
  return classStr + ' ' + toAdd.join(' ');
}

/**
 * Process an HTML string: find all class="..." attributes and add tw- equivalents.
 * Only modifies static class attributes (class="..."), not Angular bindings ([class.foo]).
 */
function processHtml(html) {
  // Match class="..." — static class attributes only
  // Uses a regex that captures the class value between double quotes
  // Does not match [class.foo]="...", [ngClass]="...", etc.
  return html.replace(/(?<!\[)class="([^"]*)"/g, (match, classStr) => {
    const updated = addTwClasses(classStr);
    return `class="${updated}"`;
  });
}

/**
 * Recursively find all .html files in a directory
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
