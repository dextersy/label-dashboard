/**
 * Replace hardcoded Bootstrap blue colors with brand CSS variables in SCSS files.
 * #007bff → var(--brand-color, #3b82f6)
 * #0056b3 → color-mix(in srgb, var(--brand-color, #3b82f6) 82%, #000000)
 * var(--bs-primary) → var(--brand-color, #3b82f6)
 * var(--bs-primary-rgb) → var(--brand-color-rgb, 59,130,246)
 * var(--bs-light) → #f8f9fa
 * var(--bs-secondary) → #6c757d
 * var(--bs-success) → #198754
 * var(--bs-danger) → #dc3545
 * var(--bs-warning) → #ffc107
 * var(--bs-info) → #0dcaf0
 *
 * Run from project root: node scripts/fix-bs-colors.js
 */

const fs = require('fs');
const path = require('path');

const REPLACEMENTS = [
  // CSS variables first (more specific)
  [/var\(--bs-primary-rgb[^)]*\)/g, 'var(--brand-color-rgb, 59,130,246)'],
  [/var\(--bs-primary[^)]*\)/g, 'var(--brand-color, #3b82f6)'],
  [/var\(--bs-light[^)]*\)/g, '#f8f9fa'],
  [/var\(--bs-secondary[^)]*\)/g, '#6c757d'],
  [/var\(--bs-success[^)]*\)/g, '#198754'],
  [/var\(--bs-danger[^)]*\)/g, '#dc3545'],
  [/var\(--bs-warning[^)]*\)/g, '#ffc107'],
  [/var\(--bs-info[^)]*\)/g, '#0dcaf0'],
  // Hardcoded hex colors
  [/#0056b3/gi, 'color-mix(in srgb, var(--brand-color, #3b82f6) 82%, #000000)'],
  [/#004085/gi, 'color-mix(in srgb, var(--brand-color, #3b82f6) 70%, #000000)'],
  [/#007bff/gi, 'var(--brand-color, #3b82f6)'],
  [/#cce5ff/gi, 'rgba(var(--brand-color-rgb, 59,130,246), 0.2)'],
  [/#b8daff/gi, 'rgba(var(--brand-color-rgb, 59,130,246), 0.3)'],
];

// Separate dynamic handler for rgba(0, 123, 255, X) patterns
// Converts to color-mix(in srgb, var(--brand-color, #3b82f6) X%, transparent)
function replaceRgbaBootstrapBlue(content) {
  return content.replace(/rgba\(0,\s*123,\s*255,\s*([\d.]+)\)/g, (match, alpha) => {
    const pct = Math.round(parseFloat(alpha) * 100);
    return `color-mix(in srgb, var(--brand-color, #3b82f6) ${pct}%, transparent)`;
  });
}

function findScssFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findScssFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.scss')) {
      results.push(fullPath);
    }
  }
  return results;
}

const appDir = path.join(__dirname, '../src/app');
const files = findScssFiles(appDir);

let filesChanged = 0;
let filesSkipped = 0;

for (const filePath of files) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let updated = content;

    for (const [pattern, replacement] of REPLACEMENTS) {
      updated = updated.replace(pattern, replacement);
    }
    updated = replaceRgbaBootstrapBlue(updated);

    if (updated !== content) {
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
