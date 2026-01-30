=== Melt Dashboard Artist EPK ===
Contributors: meltrecords
Tags: music, artist, epk, electronic press kit, dashboard
Requires at least: 5.0
Tested up to: 6.4
Stable tag: 1.0.0
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Display artist EPK (Electronic Press Kit) data from the Melt Dashboard API using shortcodes.

== Description ==

This plugin allows you to embed artist information from the Melt Dashboard API directly into your WordPress pages and posts using simple shortcodes.

**Features:**

* Easy configuration through WordPress admin settings
* Simple shortcode syntax for embedding artist data
* Support for all EPK fields including bio, images, social links, releases, and events
* Built-in caching to reduce API calls
* Secure output with proper escaping

== Installation ==

1. Upload the `melt-dashboard` folder to the `/wp-content/plugins/` directory
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Go to Settings > Melt Dashboard to configure your API URL

== Configuration ==

1. Navigate to **Settings > Melt Dashboard** in your WordPress admin
2. Enter your Melt Dashboard API URL (e.g., `https://api.meltrecords.com`)
3. Enter your Brand Origin URL - the full URL including protocol of your brand dashboard (e.g., `https://dashboard.yourlabel.com` or `http://localhost:4200` for local development). This is required for API authentication.
4. Optionally adjust the cache duration (default: 300 seconds)
5. Click **Save Settings**

**Important:** The Brand Origin URL must exactly match one of the allowed origins configured in the Melt Dashboard API, including the protocol (http/https) and port number if applicable.

== Usage ==

Use the `[melt-dashboard-artist]` shortcode to display artist EPK data.

**Basic Syntax:**
`[melt-dashboard-artist id="ARTIST_ID" field="FIELD_NAME"]`

**Parameters:**

* `id` (required) - The artist ID from the Melt Dashboard
* `field` (required) - The field to display (see Available Fields below)
* `tag` (optional) - Wrap output in an HTML tag (e.g., `tag="h1"`)
* `class` (optional) - Add CSS class to the output

**Available Fields:**

Artist fields (use dot notation):
* `artist.name` - Artist name
* `artist.bio` - Full biography (HTML)
* `artist.profile_photo` - Profile image URL (use `tag="img"` to render as image)
* `artist.social_media` - All social media links (rendered as list)
* `artist.social_media.instagram` - Instagram handle
* `artist.social_media.facebook` - Facebook handle
* `artist.social_media.twitter` - Twitter/X handle
* `artist.social_media.youtube` - YouTube channel
* `artist.social_media.tiktok` - TikTok handle
* `artist.social_media.website` - Website URL

Brand fields:
* `brand.name` - Label/brand name
* `brand.logo_url` - Brand logo URL (use `tag="img"` to render)

Collections:
* `gallery` - Photo gallery (rendered as figure elements with captions)
* `releases` - Artist releases with streaming links (rendered as list)

**Examples:**

Display artist name as heading:
`[melt-dashboard-artist id="123" field="artist.name" tag="h1"]`

Display artist bio:
`[melt-dashboard-artist id="123" field="artist.bio"]`

Display profile image:
`[melt-dashboard-artist id="123" field="artist.profile_photo" tag="img" class="artist-photo"]`

Display social media links:
`[melt-dashboard-artist id="123" field="artist.social_media" class="social-list"]`

Display releases:
`[melt-dashboard-artist id="123" field="releases"]`

Display photo gallery:
`[melt-dashboard-artist id="123" field="gallery"]`

== Styling ==

The plugin outputs HTML with specific CSS classes that you can style:

Social media links:
* `.melt-social-links` - Social links container (ul)
* `.melt-social-link` - Individual social link item (li)
* `.melt-social-instagram`, `.melt-social-facebook`, etc. - Platform-specific classes

Gallery:
* `.melt-gallery` - Gallery container (div)
* `.melt-gallery-item` - Individual gallery item (figure)

Releases:
* `.melt-releases` - Releases container (ul)
* `.melt-release` - Individual release item (li)
* `.melt-release-artwork` - Release cover art image
* `.melt-release-info` - Release info wrapper
* `.melt-release-title` - Release title
* `.melt-release-type` - Release type (Album, Single, etc.)
* `.melt-release-date` - Release date
* `.melt-streaming-links` - Streaming links container
* `.melt-streaming-link` - Individual streaming link
* `.melt-spotify`, `.melt-apple-music`, `.melt-youtube` - Platform-specific classes

== Frequently Asked Questions ==

= What API endpoint does this plugin use? =

The plugin calls `/api/public/epk/{artist_id}` on your configured API URL.

= How do I clear the cache? =

The plugin uses WordPress transients for caching. You can:
1. Set cache duration to 0 in settings to disable caching
2. Use a transient manager plugin to clear transients
3. Wait for the cache to expire naturally

= Why don't I see error messages? =

Error messages are only visible to WordPress administrators to prevent exposing sensitive information to site visitors.

== Changelog ==

= 1.0.0 =
* Initial release
