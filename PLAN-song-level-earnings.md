# Plan: Song-Level Earnings with Song-Collaborator Royalties

## Context

Currently, earnings are tracked only at the release level (`Earning.release_id`) and royalties are calculated using `ReleaseArtist` percentages (per-type: streaming, sync, download, physical). Since songs can belong to multiple releases (many-to-many via `release_song`), we need:

1. The ability to post earnings per song, tied to both the song and a specific release
2. **Song-level earnings use song collaborators for royalty calculation** (not release-level artists)
3. Release-level earnings (no song) continue to use `ReleaseArtist` percentages (backward compatible)
4. Reports consolidate both types seamlessly

**Key design choices:**
- Add optional `song_id` column to `Earning` — `NULL` means release-level (backward compatible)
- Add per-type royalty percentage columns to `SongCollaborator` (mirroring `ReleaseArtist`)
- Branch `processEarningRoyalties`: if `song_id` is set → use `SongCollaborator` percentages; otherwise → use `ReleaseArtist` percentages

---

## Step 1: Database Migration — `song_id` on Earning

**New file:** `src_new/label-dashboard-api/migrations/YYYYMMDD000001-add-song-id-to-earning.js`

- Add nullable `song_id` INTEGER column to `earning` table
- Foreign key referencing `song.id` with `ON DELETE SET NULL, ON UPDATE CASCADE`
- Add index on `song_id`
- Follow existing migration pattern (see `20260216000001-create-release-song-table.js`)

---

## Step 2: Database Migration — Royalty Percentages on SongCollaborator

**New file:** `src_new/label-dashboard-api/migrations/YYYYMMDD000002-add-royalty-percentages-to-song-collaborator.js`

Add the same per-type royalty fields that `ReleaseArtist` has:
- `streaming_royalty_percentage` DECIMAL(4,3) NOT NULL DEFAULT 0.500
- `streaming_royalty_type` ENUM('Revenue','Profit') NOT NULL DEFAULT 'Revenue'
- `sync_royalty_percentage` DECIMAL(4,3) NOT NULL DEFAULT 0.500
- `sync_royalty_type` ENUM('Revenue','Profit') NOT NULL DEFAULT 'Revenue'
- `download_royalty_percentage` DECIMAL(4,3) NOT NULL DEFAULT 0.500
- `download_royalty_type` ENUM('Revenue','Profit') NOT NULL DEFAULT 'Revenue'
- `physical_royalty_percentage` DECIMAL(4,3) NOT NULL DEFAULT 0.200
- `physical_royalty_type` ENUM('Revenue','Profit') NOT NULL DEFAULT 'Revenue'

Existing `SongCollaborator` rows will get the defaults, which match `ReleaseArtist` defaults.

---

## Step 3: Backend Model — `Earning.ts`

**File:** `src_new/label-dashboard-api/src/models/Earning.ts`

- Add `song_id?: number` to `EarningAttributes` interface
- Add `song_id` to the `Optional<>` list in `EarningCreationAttributes`
- Add `public song_id?: number` class property and `public song?: any` association property
- Add `song_id` column in `Earning.init()`: `{ type: DataTypes.INTEGER, allowNull: true, defaultValue: null }`

---

## Step 4: Backend Model — `SongCollaborator.ts`

**File:** `src_new/label-dashboard-api/src/models/SongCollaborator.ts`

Add the 8 royalty fields to the interface, class, and `SongCollaborator.init()`, mirroring `ReleaseArtist.ts` (lines 55-94):
- `streaming_royalty_percentage`, `streaming_royalty_type`
- `sync_royalty_percentage`, `sync_royalty_type`
- `download_royalty_percentage`, `download_royalty_type`
- `physical_royalty_percentage`, `physical_royalty_type`

Same data types/defaults as `ReleaseArtist`.

---

## Step 5: Backend Associations — `index.ts`

**File:** `src_new/label-dashboard-api/src/models/index.ts`

After line 140 (existing Earning associations), add:
```ts
Earning.belongsTo(Song, { foreignKey: 'song_id', as: 'song' });
Song.hasMany(Earning, { foreignKey: 'song_id', as: 'earnings' });
```

---

## Step 6: Backend Controller — Creating Earnings

**File:** `src_new/label-dashboard-api/src/controllers/financialController.ts`

### `addEarning` function
- Destructure `song_id` from `req.body`
- Validate: if `song_id` provided, confirm it belongs to the release via `ReleaseSong.findOne({ where: { release_id, song_id } })`
- Include `song_id` in `Earning.create()` call

### `bulkAddEarnings` function
- Same validation pattern per item
- Include `song_id` in each `Earning.create()`

---

## Step 7: Backend Controller — Royalty Calculation (KEY CHANGE)

**File:** `src_new/label-dashboard-api/src/controllers/financialController.ts`

### `processEarningRoyalties` function (line 422-522)

**Current flow:** Always uses `ReleaseArtist.findAll({ where: { release_id } })` → iterates artists with release-level percentages.

**New flow — branch on `earning.song_id`:**

```
if earning.song_id is set (song-level earning):
  1. Recuperable expenses: still deducted from release (unchanged — expenses are release-level)
  2. Get collaborators: SongCollaborator.findAll({ where: { song_id }, include: Artist })
  3. For each collaborator, use their song-level royalty percentages (streaming/sync/download/physical)
  4. Create Royalty with artist_id, earning_id, release_id, amount, percentage
else (release-level earning — backward compatible):
  1. Recuperable expenses deducted (unchanged)
  2. Get artists: ReleaseArtist.findAll({ where: { release_id } }) (unchanged)
  3. Use release-level royalty percentages (unchanged)
  4. Create Royalty (unchanged)
```

The Royalty record always gets both `earning_id` and `release_id` regardless of path, so existing royalty aggregation by release continues to work.

**Important:** If a song-level earning has `calculate_royalties = true` but the song has no collaborators, we should skip royalty creation (no error) — the earning is still recorded.

---

## Step 8: Backend Controller — Fetching Earnings

**File:** `src_new/label-dashboard-api/src/controllers/financialController.ts`

### `getEarnings`, `getEarningById`, `getEarningsByArtist`
- Add `{ model: Song, as: 'song', required: false }` to the `include` array (LEFT JOIN)
- Support optional `song_id` query param filter in `getEarnings`

### `downloadEarningsCSV`
- Include Song in the query
- Add "Song" column to CSV output (song title, empty string if null)

---

## Step 9: Backend — CSV Import Song Matching

**File:** `src_new/label-dashboard-api/src/controllers/financialController.ts`

### `fuzzyMatchColumns`
Add mappings: `song_title: ['song_title', 'song', 'track', 'track_title', 'song_name']` and `isrc: ['isrc', 'isrc_code']`

### `previewCsvForEarnings`
After matching a release, if `song_title` or `isrc` columns exist in the CSV row:
1. Query `ReleaseSong` + `Song` for that release
2. Match by ISRC (exact) first, then song title (exact case-insensitive)
3. Include `matched_song: { id, title, isrc } | null` in processed row

### `bulkAddEarnings` (CSV path)
Include `song_id` from matched song when present.

---

## Step 10: Backend — New Endpoint (Song Earnings Breakdown)

**Files:** `financialController.ts`, `src_new/label-dashboard-api/src/routes/financial.ts`

Add `GET /financial/releases/:release_id/song-earnings`:
- Query `Earning` where `release_id = :release_id`, group by `song_id`
- Return array: `{ song_id, song_title, total_earnings }` plus a "release-level" bucket for `song_id IS NULL`

---

## Step 11: Backend — Song Collaborator Royalty CRUD

**Files:** `financialController.ts` (or new controller), `routes/financial.ts`

### `GET /financial/releases/:release_id/song-collaborator-royalties`
- For each song in the release (via `ReleaseSong`), fetch `SongCollaborator` records with their royalty percentages
- Return: `{ songs: [{ song_id, title, collaborators: [{ artist_id, artist_name, streaming_royalty_percentage, ... }] }] }`

### `PUT /financial/releases/:release_id/song-collaborator-royalties`
- Accept array of `{ song_id, artist_id, streaming_royalty_percentage, sync_royalty_percentage, download_royalty_percentage, physical_royalty_percentage }`
- Update `SongCollaborator` records for the given release's songs
- Validate that each song_id belongs to the release and each artist_id is a collaborator on that song

---

## Step 12: Frontend — New Earning Form (Song Dropdown)

**Files:**
- `src_new/label-dashboard-web/src/app/components/financial/new-earning-form/new-earning-form.component.ts`
- `src_new/label-dashboard-web/src/app/components/financial/new-earning-form/new-earning-form.component.html`

### TypeScript
- Add `@Input() songs: any[] = []` (parent loads songs when release changes)

### HTML
Add song dropdown after release dropdown:
```html
<select [(ngModel)]="newEarningForm.song_id" name="song_id">
  <option [ngValue]="null">-- Release level (no specific song) --</option>
  <option *ngFor="let song of songs" [ngValue]="song.id">
    {{ song.title }}{{ song.isrc ? ' (' + song.isrc + ')' : '' }}
  </option>
</select>
```

Parent component (`financial.component.ts`): fetch songs when `newEarningForm.release_id` changes, pass to component, include `song_id` in submission.

---

## Step 13: Frontend — Bulk Add Earnings (Song Column)

**File:** `src_new/label-dashboard-web/src/app/pages/admin/components/bulk-add-earnings-tab.component.ts` (+ HTML)

### Manual mode
- Add `song_id` field to bulk earning row objects
- When a release is selected for a row, fetch and cache that release's songs
- Add a song dropdown column in the table (optional, defaults to null/release-level)

### CSV mode
- Show `matched_song` column in the preview table
- Include `song_id` from `matched_song` when saving

---

## Step 14: Frontend — Earnings Table Display

**Files:**
- `src_new/label-dashboard-web/src/app/components/financial/earnings-table/earnings-table.component.html`
- `src_new/label-dashboard-web/src/app/components/financial/financial-earnings-tab/financial-earnings-tab.component.ts`

- Add "Song" column between "Release" and "Description" columns
- Map `song_title` from API response in `financial.service.ts`
- Update `Earning` interface in `financial.component.ts` to include `song_title?: string`

---

## Step 15: Frontend — Song Collaborator Royalty Editor on Release Tab

**Files:**
- `src_new/label-dashboard-web/src/app/components/financial/financial-release-tab/financial-release-tab.component.ts` + `.html`
- `src_new/label-dashboard-web/src/app/pages/financial/financial.component.ts`

The current release tab shows one row per release with editable royalty percentages (for `ReleaseArtist`). We need to add a song-level section.

### Approach: Expandable song detail per release
- Add a toggle/expand button per release row (e.g. "Show Song Splits")
- When expanded, show a sub-table listing each song in the release with its collaborators and their per-type royalty percentages
- Admin can edit these percentages (same edit/save pattern as release-level royalties)
- Save calls the new `PUT /financial/releases/:release_id/song-collaborator-royalties` endpoint

### Data loading
- When "Show Song Splits" is clicked for a release, call `GET /financial/releases/:release_id/song-collaborator-royalties`
- Cache per release to avoid re-fetching

---

## Step 16: Frontend Service Updates

**File:** `src_new/label-dashboard-web/src/app/services/financial.service.ts`
- Map `song_title: earning.song?.title || null` in `getEarnings` response mapping
- Add `getSongCollaboratorRoyalties(releaseId)` and `updateSongCollaboratorRoyalties(releaseId, data)` methods

**File:** `src_new/label-dashboard-web/src/app/services/admin.service.ts`
- Add `song_id?: number` to `BulkEarning` interface
- Add song fields to `ProcessedEarningRow` interface

---

## Reporting Consolidation (Why It Works Automatically)

All existing reports aggregate by `release_id`:
- **Release earnings tab** — sums `Earning` where `release_id = X` — automatically includes song-level earnings
- **Financial summary** — sums all earnings across an artist's releases — unchanged
- **Admin earnings summary** — groups by type — unchanged
- **Label finance dashboard/breakdown** — aggregates by release — unchanged
- **Royalty reports** — Royalty records always have `release_id` regardless of whether the earning was song-level or release-level

No changes needed to any reporting queries. Song-level detail is available via the new `/releases/:id/song-earnings` endpoint when drill-down is desired.

---

## Files Modified (Summary)

| File | Action |
|------|--------|
| `migrations/YYYYMMDD000001-add-song-id-to-earning.js` | **NEW** — add `song_id` to `earning` |
| `migrations/YYYYMMDD000002-add-royalty-percentages-to-song-collaborator.js` | **NEW** — add 8 royalty columns to `song_collaborator` |
| `models/Earning.ts` | Add `song_id` field |
| `models/SongCollaborator.ts` | Add 8 royalty percentage/type fields (mirror `ReleaseArtist`) |
| `models/index.ts` | Add Earning↔Song associations |
| `controllers/financialController.ts` | Accept/validate `song_id` in create; **branch `processEarningRoyalties`** (song→SongCollaborator, release→ReleaseArtist); include Song in fetches; CSV matching; song-earnings endpoint; song-collaborator royalty CRUD |
| `routes/financial.ts` | Add song-earnings + song-collaborator-royalties routes |
| `new-earning-form.component.ts` + `.html` | Add song dropdown |
| `financial.component.ts` | Load songs on release change; update Earning interface |
| `bulk-add-earnings-tab.component.ts` + `.html` | Add song column (manual + CSV) |
| `earnings-table.component.html` | Add Song column |
| `financial-earnings-tab.component.ts` | Add song_title to table config |
| `financial-release-tab.component.ts` + `.html` | Expandable song collaborator royalty editor per release |
| `services/financial.service.ts` | Map song_title; add song-collaborator-royalty service methods |
| `services/admin.service.ts` | Add song_id to interfaces |

---

## Verification

1. Run both migrations against the database
2. Verify existing `SongCollaborator` rows have default royalty percentages
3. Set custom royalty percentages for a song's collaborators via the release tab UI
4. Create a **song-level earning** with `calculate_royalties = true` → verify royalties are created using **SongCollaborator** percentages (not ReleaseArtist)
5. Create a **release-level earning** (no song) with `calculate_royalties = true` → verify royalties use **ReleaseArtist** percentages (backward compatible)
6. Check earnings list — Song column shows for song-level entries, blank for release-level
7. Check release earnings tab — totals include both types of earnings
8. Check royalty reports — royalties from both paths appear and aggregate correctly by release
9. Test CSV import with a `song_title`/`isrc` column — verify song matching and royalty calculation
10. Test CSV import without song columns — verify release-level only (backward compatible)
