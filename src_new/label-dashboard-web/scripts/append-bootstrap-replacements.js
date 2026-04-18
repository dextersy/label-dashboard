/**
 * Appends Bootstrap component replacement CSS to components.scss.
 * These styles replace Bootstrap's modal, alert, nav-tabs, input-group,
 * form-check, badge, pagination, spinner, and dropdown CSS.
 */

const fs = require('fs');
const path = require('path');

const TARGET = path.join(__dirname, '../src/styles/components.scss');

const CSS = `

/* ================================= */
/* MODAL STRUCTURE                   */
/* Positioning override lives in     */
/* @layer components of styles.scss  */
/* ================================= */

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1040;
  background-color: rgba(0, 0, 0, 0.5);

  &.show { opacity: 1; }
  &.fade { opacity: 0; transition: opacity 0.15s linear; }
}

.modal-dialog {
  position: relative;
  width: auto;
  margin: 60px auto;
  max-width: 500px;
  pointer-events: none;
}

.modal-dialog-centered {
  display: flex;
  align-items: center;
  min-height: calc(100% - 60px);
}

.modal-dialog-scrollable {
  .modal-content {
    max-height: calc(100vh - 120px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .modal-body {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
}

.modal-content {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  pointer-events: auto;
  background-color: #fff;
  background-clip: padding-box;
  border: none;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
  outline: 0;
}

.modal-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #e5e7eb;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}

.modal-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a202c;
  margin: 0;
  line-height: 1.5;
}

.modal-body {
  position: relative;
  flex: 1 1 auto;
  padding: 20px 24px;
  overflow-y: auto;
}

.modal-footer {
  display: flex;
  flex-wrap: wrap;
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 20px;
  border-top: 1px solid #e5e7eb;
  border-bottom-right-radius: 12px;
  border-bottom-left-radius: 12px;
}

.modal-sm { max-width: 300px; }
.modal-lg { max-width: 800px; }
.modal-xl { max-width: 1140px; }

@media (max-width: 576px) {
  .modal-dialog { margin: 0; max-width: 100%; }
  .modal-content { border-radius: 0; }
}

/* ================================= */
/* ALERTS                            */
/* ================================= */

.alert {
  position: relative;
  padding: 12px 16px;
  margin-bottom: 16px;
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
}

.alert-danger, .alert-error {
  color: #991b1b;
  background-color: #fef2f2;
  border-color: #fecaca;
}

.alert-success {
  color: #166534;
  background-color: #f0fdf4;
  border-color: #bbf7d0;
}

.alert-warning {
  color: #92400e;
  background-color: #fffbeb;
  border-color: #fde68a;
}

.alert-info {
  color: #1e40af;
  background-color: #eff6ff;
  border-color: #bfdbfe;
}

/* ================================= */
/* NAVIGATION & TABS                 */
/* ================================= */

.nav {
  display: flex;
  flex-wrap: wrap;
  padding-left: 0;
  margin-bottom: 0;
  list-style: none;
}

.nav-link {
  display: block;
  padding: 8px 16px;
  font-size: 13px;
  color: var(--brand-color, #3b82f6);
  text-decoration: none;
  transition: color 0.15s ease, background-color 0.15s ease;
  border-radius: 4px;

  &:hover {
    color: color-mix(in srgb, var(--brand-color, #3b82f6) 80%, #000);
  }

  &.disabled {
    color: #6c757d;
    pointer-events: none;
    cursor: default;
  }
}

.nav-tabs {
  border-bottom: 1px solid #dee2e6;
  margin-bottom: 0;

  .nav-link {
    margin-bottom: -1px;
    border: 1px solid transparent;
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    color: #6c757d;

    &:hover {
      border-color: #e9ecef #e9ecef #dee2e6;
      color: #495057;
      background-color: transparent;
    }

    &.active {
      color: var(--brand-color, #3b82f6);
      background-color: #fff;
      border-color: #dee2e6 #dee2e6 #fff;
    }
  }
}

.tab-content > .tab-pane { display: none; }
.tab-content > .active { display: block; }

/* ================================= */
/* INPUT GROUP                       */
/* ================================= */

.input-group {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  width: 100%;

  > .form-control,
  > .form-select {
    position: relative;
    flex: 1 1 auto;
    width: 1%;
    min-width: 0;
  }
}

.input-group-prepend,
.input-group-append {
  display: flex;
}

.input-group-text {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
  color: #495057;
  text-align: center;
  white-space: nowrap;
  background-color: #f8f9fa;
  border: 1px solid transparent;
  border-radius: 8px 0 0 8px;
}

.input-group-prepend + .form-control,
.input-group-prepend + .form-select {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

/* ================================= */
/* FORM CHECK                        */
/* ================================= */

.form-check {
  display: block;
  min-height: 1.5rem;
  padding-left: 1.5em;
  margin-bottom: 0.125rem;
}

.form-check-input {
  width: 1em;
  height: 1em;
  margin-top: 0.25em;
  vertical-align: top;
  background-color: #fff;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  border: 1px solid rgba(0, 0, 0, 0.25);
  appearance: none;
  border-radius: 0.25em;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;

  // Checkmark SVG encoded (no single quotes in data URLs to avoid SCSS parse issues)
  &:checked {
    background-color: var(--brand-color, #3b82f6);
    border-color: var(--brand-color, #3b82f6);
    background-image: url("data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27%3e%3cpath fill=%27none%27 stroke=%27%23fff%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%273%27 d=%27M6 10l3 3l6-6%27/%3e%3c/svg%3e");
  }

  &[type="radio"] {
    border-radius: 50%;
    &:checked {
      background-image: url("data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%27-4 -4 8 8%27%3e%3ccircle r=%272%27 fill=%27%23fff%27/%3e%3c/svg%3e");
    }
  }

  &:indeterminate {
    background-color: var(--brand-color, #3b82f6);
    border-color: var(--brand-color, #3b82f6);
    background-image: url("data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27%3e%3cpath fill=%27none%27 stroke=%27%23fff%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%273%27 d=%27M6 10h8%27/%3e%3c/svg%3e");
  }

  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.form-check-label { cursor: pointer; padding-left: 0.25em; }

.form-switch {
  padding-left: 2.5em;

  .form-check-input {
    width: 2em;
    margin-left: -2.5em;
    border-radius: 2em;

    &:checked {
      background-image: url("data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%27-4 -4 8 8%27%3e%3ccircle r=%273%27 fill=%27%23fff%27/%3e%3c/svg%3e");
      background-position: right center;
    }

    &:not(:checked) {
      background-image: url("data:image/svg+xml,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%27-4 -4 8 8%27%3e%3ccircle r=%273%27 fill=%27rgba(0,0,0,0.25)%27/%3e%3c/svg%3e");
    }
  }
}

/* ================================= */
/* BADGE                             */
/* ================================= */

.badge {
  display: inline-block;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  color: #fff;
  text-align: center;
  white-space: nowrap;
  vertical-align: baseline;
  border-radius: 12px;
  letter-spacing: 0.3px;
}

.bg-primary    { background-color: var(--brand-color, #3b82f6) !important; color: #fff; }
.bg-secondary  { background-color: #6c757d !important; color: #fff; }
.bg-success    { background-color: #198754 !important; color: #fff; }
.bg-danger     { background-color: #dc3545 !important; color: #fff; }
.bg-warning    { background-color: #ffc107 !important; color: #212529; }
.bg-info       { background-color: #0dcaf0 !important; color: #212529; }
.bg-light      { background-color: #f8f9fa !important; color: #212529; }
.bg-dark       { background-color: #212529 !important; color: #fff; }

.badge-primary   { background-color: var(--brand-color, #3b82f6); }
.badge-secondary { background-color: #6c757d; }
.badge-success   { background-color: #198754; }
.badge-danger    { background-color: #dc3545; }
.badge-warning   { background-color: #ffc107; color: #212529; }
.badge-info      { background-color: #0dcaf0; color: #212529; }
.badge-light     { background-color: #f8f9fa; color: #212529; }
.badge-dark      { background-color: #212529; }

.text-bg-primary   { background-color: var(--brand-color, #3b82f6) !important; color: #fff !important; }
.text-bg-secondary { background-color: #6c757d !important; color: #fff !important; }
.text-bg-success   { background-color: #198754 !important; color: #fff !important; }
.text-bg-danger    { background-color: #dc3545 !important; color: #fff !important; }
.text-bg-warning   { background-color: #ffc107 !important; color: #212529 !important; }
.text-bg-info      { background-color: #0dcaf0 !important; color: #212529 !important; }

/* ================================= */
/* PAGINATION (global)               */
/* ================================= */

.pagination {
  display: flex;
  padding-left: 0;
  list-style: none;
  border-radius: 4px;
}

.page-link {
  position: relative;
  display: block;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--brand-color, #3b82f6);
  background-color: #fff;
  border: 1px solid #dee2e6;
  text-decoration: none;
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;

  &:hover {
    z-index: 2;
    color: color-mix(in srgb, var(--brand-color, #3b82f6) 80%, #000);
    background-color: #e9ecef;
    border-color: #dee2e6;
  }

  &:focus {
    z-index: 3;
    outline: 0;
    box-shadow: 0 0 0 0.25rem color-mix(in srgb, var(--brand-color, #3b82f6) 25%, transparent);
  }
}

.page-item {
  &:first-child .page-link { border-top-left-radius: 4px; border-bottom-left-radius: 4px; }
  &:last-child .page-link { border-top-right-radius: 4px; border-bottom-right-radius: 4px; }

  &.active .page-link {
    z-index: 3;
    color: #fff;
    background-color: var(--brand-color, #3b82f6);
    border-color: var(--brand-color, #3b82f6);
  }

  &.disabled .page-link {
    color: #6c757d;
    pointer-events: none;
    background-color: #fff;
    border-color: #dee2e6;
    cursor: not-allowed;
  }
}

/* ================================= */
/* SPINNER                           */
/* ================================= */

.spinner-border {
  display: inline-block;
  width: 2rem;
  height: 2rem;
  vertical-align: -0.125em;
  border: 0.25em solid currentcolor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spinner-border 0.75s linear infinite;
}

@keyframes spinner-border { to { transform: rotate(360deg); } }

.spinner-border-sm { width: 1rem; height: 1rem; border-width: 0.2em; }

/* ================================= */
/* TEXT COLOR UTILITIES              */
/* ================================= */

.text-primary   { color: var(--brand-color, #3b82f6) !important; }
.text-secondary { color: #6c757d !important; }
.text-success   { color: #198754 !important; }
.text-danger    { color: #dc3545 !important; }
.text-warning   { color: #856404 !important; }
.text-info      { color: #0891b2 !important; }
.text-muted     { color: #6c757d !important; }
.text-dark      { color: #212529 !important; }
.text-white     { color: #fff !important; }

/* ================================= */
/* CLOSE BUTTON                      */
/* ================================= */

.btn-close {
  box-sizing: content-box;
  width: 1em;
  height: 1em;
  padding: 0.25em;
  color: #6b7280;
  background: transparent;
  border: 0;
  border-radius: 0.25rem;
  opacity: 0.5;
  cursor: pointer;
  font-size: 20px;
  line-height: 1;

  &:before { content: "x"; }
  &:hover { opacity: 0.75; }
  &:focus { opacity: 1; outline: 0; }
}

/* ================================= */
/* DROPDOWN                          */
/* ================================= */

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1050;
  min-width: 10rem;
  padding: 6px 0;
  font-size: 13px;
  color: #212529;
  text-align: left;
  list-style: none;
  background-color: #fff;
  background-clip: padding-box;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
}

.dropdown-item {
  display: block;
  width: calc(100% - 12px);
  padding: 6px 16px;
  clear: both;
  font-weight: 400;
  color: #212529;
  text-align: inherit;
  white-space: nowrap;
  background-color: transparent;
  border: 0;
  cursor: pointer;
  text-decoration: none;
  border-radius: 6px;
  margin: 1px 6px;
  transition: background-color 0.15s ease;

  &:hover, &:focus {
    background-color: #f8f9fa;
    color: #1a202c;
  }
}

.dropdown-divider {
  height: 0;
  margin: 6px 0;
  overflow: hidden;
  border-top: 1px solid #e5e7eb;
}
`;

const current = fs.readFileSync(TARGET, 'utf8');
fs.writeFileSync(TARGET, current + CSS, 'utf8');
console.log(`Appended ${CSS.length} chars to ${path.basename(TARGET)}`);
