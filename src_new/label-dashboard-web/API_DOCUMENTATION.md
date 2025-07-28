# API Documentation for Catalog Number Generation

## New Endpoint Required

### GET /releases/highest-catalog-number

**Description:** Returns the highest catalog number for releases with a specific prefix.

**Query Parameters:**
- `prefix` (string, required): The catalog prefix to search for (e.g., "MELT", "REC", etc.)

**Response:**
```json
{
  "highest_number": 123
}
```

**Implementation Logic:**
1. Query the `release` table for all releases with `catalog_no` that match the pattern `^{prefix}[0-9]+$`
2. Extract the numeric part from each matching catalog number
3. Return the highest number found, or 0 if no matches

**SQL Example:**
```sql
SELECT CAST(SUBSTRING(catalog_no, LENGTH(?) + 1) AS UNSIGNED) as number
FROM release 
WHERE brand_id = ? 
  AND catalog_no REGEXP CONCAT('^', ?, '[0-9]+$')
ORDER BY number DESC 
LIMIT 1
```

**Error Handling:**
- If no releases found with the prefix, return `{ "highest_number": 0 }`
- Return appropriate HTTP error codes for authentication/authorization issues

## Updated Brand Settings

The existing brand settings API should now include the `catalog_prefix` field:

**GET /brand/by-domain**

**Updated Response:**
```json
{
  "domain": "example.com",
  "brand": {
    "id": 1,
    "name": "Example Label",
    "logo_url": "...",
    "brand_color": "#000000",
    "brand_website": "...",
    "favicon_url": "...",
    "release_submission_url": "...",
    "catalog_prefix": "MELT"
  }
}
```

## Frontend Implementation

The frontend now:

1. **Checks for cached brand settings** with catalog_prefix
2. **Loads brand settings** if not cached 
3. **Calls new API endpoint** to get highest catalog number for the prefix
4. **Generates next catalog number** using format: `{prefix}{padded_3_digit_number}`
   - Example: "MELT001", "MELT002", etc.
5. **Falls back to existing API** if brand settings unavailable

## Migration Notes

- Existing releases without the prefix pattern will not affect the numbering
- The catalog_prefix should be added to the brand table in the database
- Default prefixes can be set during migration based on existing catalog numbers