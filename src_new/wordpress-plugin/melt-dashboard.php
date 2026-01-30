<?php
/**
 * Plugin Name: Melt Dashboard Artist EPK
 * Plugin URI: https://meltrecords.com
 * Description: Display artist EPK data from the Melt Dashboard API using shortcodes.
 * Version: 1.0.0
 * Author: Melt Records
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: melt-dashboard
 */

if (!defined('ABSPATH')) {
    exit;
}

class MeltDashboardPlugin {
    private static $instance = null;
    private $option_name = 'melt_dashboard_settings';

    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_init', [$this, 'register_settings']);
        add_action('wp_ajax_melt_dashboard_test_api', [$this, 'ajax_test_api']);
        add_shortcode('melt-dashboard-artist', [$this, 'render_artist_shortcode']);
    }

    /**
     * Add settings page to WordPress admin menu
     */
    public function add_admin_menu() {
        add_options_page(
            __('Melt Dashboard Settings', 'melt-dashboard'),
            __('Melt Dashboard', 'melt-dashboard'),
            'manage_options',
            'melt-dashboard',
            [$this, 'render_settings_page']
        );
    }

    /**
     * Register plugin settings
     */
    public function register_settings() {
        register_setting(
            'melt_dashboard_options',
            $this->option_name,
            [$this, 'sanitize_settings']
        );

        add_settings_section(
            'melt_dashboard_main',
            __('API Configuration', 'melt-dashboard'),
            [$this, 'render_section_info'],
            'melt-dashboard'
        );

        add_settings_field(
            'api_url',
            __('API URL', 'melt-dashboard'),
            [$this, 'render_api_url_field'],
            'melt-dashboard',
            'melt_dashboard_main'
        );

        add_settings_field(
            'cache_duration',
            __('Cache Duration (seconds)', 'melt-dashboard'),
            [$this, 'render_cache_duration_field'],
            'melt-dashboard',
            'melt_dashboard_main'
        );

        add_settings_field(
            'brand_domain',
            __('Brand Domain', 'melt-dashboard'),
            [$this, 'render_brand_domain_field'],
            'melt-dashboard',
            'melt_dashboard_main'
        );
    }

    /**
     * Sanitize settings input
     */
    public function sanitize_settings($input) {
        $sanitized = [];

        if (isset($input['api_url'])) {
            $sanitized['api_url'] = esc_url_raw(rtrim($input['api_url'], '/'));
        }

        if (isset($input['cache_duration'])) {
            $sanitized['cache_duration'] = absint($input['cache_duration']);
        }

        if (isset($input['brand_domain'])) {
            // Sanitize - keep protocol, remove trailing slashes
            $domain = strtolower(trim($input['brand_domain']));
            $domain = rtrim($domain, '/');
            $sanitized['brand_domain'] = esc_url_raw($domain);
        }

        return $sanitized;
    }

    /**
     * Get plugin settings
     */
    private function get_settings() {
        $defaults = [
            'api_url' => '',
            'cache_duration' => 300, // 5 minutes default
            'brand_domain' => '',
        ];
        return wp_parse_args(get_option($this->option_name, []), $defaults);
    }

    /**
     * Render settings page
     */
    public function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            <form action="options.php" method="post">
                <?php
                settings_fields('melt_dashboard_options');
                do_settings_sections('melt-dashboard');
                submit_button(__('Save Settings', 'melt-dashboard'));
                ?>
            </form>

            <hr>
            <h2><?php _e('API Connection Test', 'melt-dashboard'); ?></h2>
            <p><?php _e('Test the connection to the Melt Dashboard API using the settings above.', 'melt-dashboard'); ?></p>
            <p>
                <label for="melt-test-artist-id"><?php _e('Artist ID for test:', 'melt-dashboard'); ?></label>
                <input type="number" id="melt-test-artist-id" value="1" min="1" style="width: 80px;">
                <button type="button" id="melt-test-api-btn" class="button button-secondary">
                    <?php _e('Test API Connection', 'melt-dashboard'); ?>
                </button>
            </p>
            <div id="melt-test-result" style="margin-top: 10px;"></div>

            <script>
            jQuery(document).ready(function($) {
                $('#melt-test-api-btn').on('click', function() {
                    var $btn = $(this);
                    var $result = $('#melt-test-result');
                    var artistId = $('#melt-test-artist-id').val() || '1';

                    $btn.prop('disabled', true).text('<?php _e('Testing...', 'melt-dashboard'); ?>');
                    $result.html('');

                    $.ajax({
                        url: ajaxurl,
                        type: 'POST',
                        data: {
                            action: 'melt_dashboard_test_api',
                            nonce: '<?php echo wp_create_nonce('melt_dashboard_test_api'); ?>',
                            artist_id: artistId
                        },
                        success: function(response) {
                            if (response.success) {
                                $result.html('<div class="notice notice-success inline"><p>' + response.data.message + '</p></div>');
                            } else {
                                $result.html('<div class="notice notice-error inline"><p>' + response.data.message + '</p></div>');
                            }
                        },
                        error: function() {
                            $result.html('<div class="notice notice-error inline"><p><?php _e('Failed to perform test request.', 'melt-dashboard'); ?></p></div>');
                        },
                        complete: function() {
                            $btn.prop('disabled', false).text('<?php _e('Test API Connection', 'melt-dashboard'); ?>');
                        }
                    });
                });
            });
            </script>

            <hr>
            <h2><?php _e('Shortcode Usage', 'melt-dashboard'); ?></h2>
            <p><?php _e('Use the following shortcode to display artist EPK data:', 'melt-dashboard'); ?></p>
            <code>[melt-dashboard-artist id="artist-id" field="field-name"]</code>

            <h3><?php _e('Available Fields', 'melt-dashboard'); ?></h3>
            <p><strong><?php _e('Artist Fields (use artist.fieldname):', 'melt-dashboard'); ?></strong></p>
            <ul>
                <li><code>artist.name</code> - <?php _e('Artist name', 'melt-dashboard'); ?></li>
                <li><code>artist.bio</code> - <?php _e('Artist biography (HTML)', 'melt-dashboard'); ?></li>
                <li><code>artist.band_members</code> - <?php _e('Band members (plain text, newlines as line breaks)', 'melt-dashboard'); ?></li>
                <li><code>artist.profile_photo</code> - <?php _e('Profile image URL', 'melt-dashboard'); ?></li>
                <li><code>artist.social_media</code> - <?php _e('Social media links (FontAwesome icons)', 'melt-dashboard'); ?></li>
                <li><code>artist.social_media.instagram</code> - <?php _e('Instagram handle', 'melt-dashboard'); ?></li>
                <li><code>artist.social_media.facebook</code> - <?php _e('Facebook handle', 'melt-dashboard'); ?></li>
                <li><code>artist.social_media.twitter</code> - <?php _e('Twitter/X handle', 'melt-dashboard'); ?></li>
                <li><code>artist.social_media.youtube</code> - <?php _e('YouTube channel', 'melt-dashboard'); ?></li>
                <li><code>artist.social_media.tiktok</code> - <?php _e('TikTok handle', 'melt-dashboard'); ?></li>
                <li><code>artist.social_media.website</code> - <?php _e('Website URL', 'melt-dashboard'); ?></li>
            </ul>
            <p><strong><?php _e('Brand Fields:', 'melt-dashboard'); ?></strong></p>
            <ul>
                <li><code>brand.name</code> - <?php _e('Label/brand name', 'melt-dashboard'); ?></li>
                <li><code>brand.logo_url</code> - <?php _e('Brand logo URL', 'melt-dashboard'); ?></li>
            </ul>
            <p><strong><?php _e('Gallery & Releases:', 'melt-dashboard'); ?></strong></p>
            <ul>
                <li><code>gallery</code> - <?php _e('Photo gallery (responsive grid)', 'melt-dashboard'); ?></li>
                <li><code>releases</code> - <?php _e('Artist releases (rendered as list)', 'melt-dashboard'); ?></li>
            </ul>

            <h3><?php _e('Social Media Options', 'melt-dashboard'); ?></h3>
            <p><?php _e('Social media links are displayed as FontAwesome icons. Options:', 'melt-dashboard'); ?></p>
            <ul>
                <li><code>target</code> - <?php _e('Link target: "_blank" for new tab, "_self" for same tab (default: "_blank")', 'melt-dashboard'); ?></li>
                <li><code>align</code> - <?php _e('"left", "center", or "right" (default: "left")', 'melt-dashboard'); ?></li>
            </ul>

            <h3><?php _e('Gallery Options', 'melt-dashboard'); ?></h3>
            <p><?php _e('When using field="gallery", you can choose between grid or slideshow display:', 'melt-dashboard'); ?></p>
            <ul>
                <li><code>display</code> - <?php _e('"grid" (default) or "slideshow"', 'melt-dashboard'); ?></li>
                <li><code>max_images</code> - <?php _e('Maximum images to display (default: 12)', 'melt-dashboard'); ?></li>
            </ul>
            <p><strong><?php _e('Grid Options:', 'melt-dashboard'); ?></strong></p>
            <ul>
                <li><code>img_width</code> - <?php _e('Thumbnail width in pixels (default: 100)', 'melt-dashboard'); ?></li>
                <li><code>img_height</code> - <?php _e('Thumbnail height in pixels (default: 100)', 'melt-dashboard'); ?></li>
                <li><code>desktop_row_count</code> - <?php _e('Images per row on desktop (default: 4)', 'melt-dashboard'); ?></li>
                <li><code>tablet_row_count</code> - <?php _e('Images per row on tablet (default: 3)', 'melt-dashboard'); ?></li>
                <li><code>mobile_row_count</code> - <?php _e('Images per row on mobile (default: 2)', 'melt-dashboard'); ?></li>
                <li><code>gap</code> - <?php _e('Gap between images in pixels (default: 0)', 'melt-dashboard'); ?></li>
            </ul>
            <p><strong><?php _e('Slideshow Options:', 'melt-dashboard'); ?></strong></p>
            <ul>
                <li><code>slideshow_width</code> - <?php _e('Slideshow width in pixels (default: 800)', 'melt-dashboard'); ?></li>
                <li><code>slideshow_height</code> - <?php _e('Slideshow height in pixels (default: 500)', 'melt-dashboard'); ?></li>
                <li><code>slideshow_width_mobile</code> - <?php _e('Slideshow width on mobile (optional, falls back to slideshow_width)', 'melt-dashboard'); ?></li>
                <li><code>slideshow_height_mobile</code> - <?php _e('Slideshow height on mobile (optional, falls back to slideshow_height)', 'melt-dashboard'); ?></li>
                <li><code>slide_duration</code> - <?php _e('Time per slide in milliseconds (default: 5000)', 'melt-dashboard'); ?></li>
                <li><code>ken_burns</code> - <?php _e('"true" or "false" - enable Ken Burns zoom effect (default: false)', 'melt-dashboard'); ?></li>
            </ul>

            <h3><?php _e('Examples', 'melt-dashboard'); ?></h3>
            <pre>[melt-dashboard-artist id="123" field="artist.name"]
[melt-dashboard-artist id="123" field="artist.bio"]
[melt-dashboard-artist id="123" field="artist.profile_photo" tag="img"]
[melt-dashboard-artist id="123" field="artist.social_media"]
[melt-dashboard-artist id="123" field="artist.social_media" target="_self"]
[melt-dashboard-artist id="123" field="artist.social_media" align="center"]
[melt-dashboard-artist id="123" field="releases"]
[melt-dashboard-artist id="123" field="gallery"]
[melt-dashboard-artist id="123" field="gallery" img_width="150" img_height="150" desktop_row_count="5" gap="4"]
[melt-dashboard-artist id="123" field="gallery" display="slideshow"]
[melt-dashboard-artist id="123" field="gallery" display="slideshow" slideshow_width="1000" slideshow_height="600" slide_duration="4000" ken_burns="true"]
[melt-dashboard-artist id="123" field="gallery" display="slideshow" slideshow_width="800" slideshow_height="500" slideshow_width_mobile="350" slideshow_height_mobile="250"]</pre>
        </div>
        <?php
    }

    /**
     * Render section info
     */
    public function render_section_info() {
        echo '<p>' . __('Configure the connection to the Melt Dashboard API.', 'melt-dashboard') . '</p>';
    }

    /**
     * Render API URL field
     */
    public function render_api_url_field() {
        $settings = $this->get_settings();
        ?>
        <input type="url"
               name="<?php echo esc_attr($this->option_name); ?>[api_url]"
               value="<?php echo esc_attr($settings['api_url']); ?>"
               class="regular-text"
               placeholder="https://api.example.com">
        <p class="description">
            <?php _e('Enter the base URL of the Melt Dashboard API (e.g., https://api.meltrecords.com)', 'melt-dashboard'); ?>
        </p>
        <?php
    }

    /**
     * Render cache duration field
     */
    public function render_cache_duration_field() {
        $settings = $this->get_settings();
        ?>
        <input type="number"
               name="<?php echo esc_attr($this->option_name); ?>[cache_duration]"
               value="<?php echo esc_attr($settings['cache_duration']); ?>"
               class="small-text"
               min="0"
               step="1">
        <p class="description">
            <?php _e('How long to cache API responses. Set to 0 to disable caching.', 'melt-dashboard'); ?>
        </p>
        <?php
    }

    /**
     * Render brand domain field
     */
    public function render_brand_domain_field() {
        $settings = $this->get_settings();
        ?>
        <input type="url"
               name="<?php echo esc_attr($this->option_name); ?>[brand_domain]"
               value="<?php echo esc_attr($settings['brand_domain']); ?>"
               class="regular-text"
               placeholder="http://localhost:4200">
        <p class="description">
            <?php _e('The full origin URL of your brand dashboard, including protocol (e.g., https://dashboard.yourlabel.com or http://localhost:4200). Must match an allowed origin in the API.', 'melt-dashboard'); ?>
        </p>
        <?php
    }

    /**
     * AJAX handler for API connection test
     */
    public function ajax_test_api() {
        // Verify nonce
        if (!check_ajax_referer('melt_dashboard_test_api', 'nonce', false)) {
            wp_send_json_error(['message' => __('Security check failed.', 'melt-dashboard')]);
        }

        // Check permissions
        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Permission denied.', 'melt-dashboard')]);
        }

        $settings = $this->get_settings();
        $artist_id = isset($_POST['artist_id']) ? absint($_POST['artist_id']) : 1;

        // Validate settings
        if (empty($settings['api_url'])) {
            wp_send_json_error(['message' => __('API URL is not configured.', 'melt-dashboard')]);
        }

        if (empty($settings['brand_domain'])) {
            wp_send_json_error(['message' => __('Brand Origin URL is not configured.', 'melt-dashboard')]);
        }

        // Make test request
        $api_url = $settings['api_url'] . '/api/public/epk/' . $artist_id;
        $brand_url = $settings['brand_domain'];

        $response = wp_remote_get($api_url, [
            'timeout' => 15,
            'headers' => [
                'Accept' => 'application/json',
                'Origin' => $brand_url,
                'Referer' => $brand_url . '/',
            ],
        ]);

        if (is_wp_error($response)) {
            wp_send_json_error([
                'message' => sprintf(
                    __('Connection failed: %s', 'melt-dashboard'),
                    $response->get_error_message()
                )
            ]);
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);

        if ($status_code === 200) {
            $data = json_decode($body, true);
            $artist_name = isset($data['artist']['name']) ? $data['artist']['name'] : __('Unknown', 'melt-dashboard');
            wp_send_json_success([
                'message' => sprintf(
                    __('Connection successful! (Status: %d, Artist: %s)', 'melt-dashboard'),
                    $status_code,
                    $artist_name
                )
            ]);
        } else {
            $error_data = json_decode($body, true);
            $error_msg = isset($error_data['error']) ? $error_data['error'] : __('Unknown error', 'melt-dashboard');
            wp_send_json_error([
                'message' => sprintf(
                    __('API returned status %d: %s', 'melt-dashboard'),
                    $status_code,
                    $error_msg
                )
            ]);
        }
    }

    /**
     * Fetch artist EPK data from API
     */
    private function fetch_artist_epk($artist_id) {
        $settings = $this->get_settings();

        if (empty($settings['api_url'])) {
            return new WP_Error('no_api_url', __('API URL not configured', 'melt-dashboard'));
        }

        if (empty($settings['brand_domain'])) {
            return new WP_Error('no_brand_domain', __('Brand origin URL not configured', 'melt-dashboard'));
        }

        $cache_key = 'melt_epk_' . md5($artist_id);
        $cache_duration = $settings['cache_duration'];

        // Check cache first
        if ($cache_duration > 0) {
            $cached = get_transient($cache_key);
            if ($cached !== false) {
                return $cached;
            }
        }

        $api_url = $settings['api_url'] . '/api/public/epk/' . urlencode($artist_id);

        // Send Origin header for API authentication
        // The brand_domain setting should include the full URL with protocol (e.g., http://localhost:4200)
        $brand_url = $settings['brand_domain'];

        $response = wp_remote_get($api_url, [
            'timeout' => 15,
            'headers' => [
                'Accept' => 'application/json',
                'Origin' => $brand_url,
                'Referer' => $brand_url . '/',
            ],
        ]);

        if (is_wp_error($response)) {
            return $response;
        }

        $status_code = wp_remote_retrieve_response_code($response);
        if ($status_code !== 200) {
            return new WP_Error(
                'api_error',
                sprintf(__('API returned status %d', 'melt-dashboard'), $status_code)
            );
        }

        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            return new WP_Error('json_error', __('Invalid JSON response from API', 'melt-dashboard'));
        }

        // Cache the response
        if ($cache_duration > 0) {
            set_transient($cache_key, $data, $cache_duration);
        }

        return $data;
    }

    /**
     * Render the artist shortcode
     */
    public function render_artist_shortcode($atts) {
        $atts = shortcode_atts([
            'id' => '',
            'field' => '',
            'tag' => '',
            'class' => '',
            // Gallery grid options
            'display' => 'grid',
            'img_width' => '100',
            'img_height' => '100',
            'desktop_row_count' => '4',
            'tablet_row_count' => '3',
            'mobile_row_count' => '2',
            'max_images' => '12',
            'gap' => '0',
            // Gallery slideshow options
            'slideshow_width' => '800',
            'slideshow_height' => '500',
            'slideshow_width_mobile' => '',
            'slideshow_height_mobile' => '',
            'slide_duration' => '5000',
            'ken_burns' => 'false',
            // Link options
            'target' => '',
            // Social media options
            'align' => 'left',
        ], $atts, 'melt-dashboard-artist');

        if (empty($atts['id'])) {
            return $this->render_error(__('Missing artist ID', 'melt-dashboard'));
        }

        if (empty($atts['field'])) {
            return $this->render_error(__('Missing field name', 'melt-dashboard'));
        }

        $epk_data = $this->fetch_artist_epk($atts['id']);

        if (is_wp_error($epk_data)) {
            return $this->render_error($epk_data->get_error_message());
        }

        return $this->render_field($epk_data, $atts['field'], $atts);
    }

    /**
     * Render a specific field from EPK data
     */
    private function render_field($data, $field, $atts = []) {
        $tag = isset($atts['tag']) ? $atts['tag'] : '';
        $class = isset($atts['class']) ? $atts['class'] : '';

        // Handle nested field access with dot notation
        $value = $this->get_nested_value($data, $field);

        if ($value === null) {
            return '';
        }

        $class_attr = $class ? ' class="' . esc_attr($class) . '"' : '';

        // Handle special fields based on the field path
        switch ($field) {
            case 'artist.profile_photo':
            case 'brand.logo_url':
                if ($tag === 'img') {
                    return '<img src="' . esc_url($value) . '"' . $class_attr . ' alt="">';
                }
                return esc_url($value);

            case 'artist.social_media':
                return $this->render_social_media($value, $atts);

            case 'gallery':
                return $this->render_gallery($value, $atts);

            case 'releases':
                return $this->render_releases($value, $class);

            case 'artist.bio':
                // Bio may contain HTML, sanitize but preserve allowed tags
                $allowed_tags = wp_kses_allowed_html('post');
                if ($tag) {
                    return '<' . esc_attr($tag) . $class_attr . '>' . wp_kses($value, $allowed_tags) . '</' . esc_attr($tag) . '>';
                }
                return wp_kses($value, $allowed_tags);

            case 'artist.band_members':
                // Band members is plain text with newlines converted to <br>
                $formatted = nl2br(esc_html($value));
                if ($tag) {
                    return '<' . esc_attr($tag) . $class_attr . '>' . $formatted . '</' . esc_attr($tag) . '>';
                }
                return $formatted;

            default:
                // Plain text fields
                if (is_array($value)) {
                    $value = implode(', ', $value);
                }

                if ($tag) {
                    return '<' . esc_attr($tag) . $class_attr . '>' . esc_html($value) . '</' . esc_attr($tag) . '>';
                }
                return esc_html($value);
        }
    }

    /**
     * Get nested value from array using dot notation
     */
    private function get_nested_value($data, $field) {
        $keys = explode('.', $field);
        $value = $data;

        foreach ($keys as $key) {
            if (is_array($value) && isset($value[$key])) {
                $value = $value[$key];
            } else {
                return null;
            }
        }

        return $value;
    }

    /**
     * Render social media object as icon links
     */
    private function render_social_media($social_media, $atts = []) {
        if (!is_array($social_media)) {
            return '';
        }

        $class = isset($atts['class']) ? $atts['class'] : '';
        $target = isset($atts['target']) ? $atts['target'] : '_blank';
        $align = isset($atts['align']) ? $atts['align'] : 'left';

        // Platform config: base_url, FontAwesome icon class
        $platforms = [
            'instagram' => ['url' => 'https://instagram.com/', 'icon' => 'fa-brands fa-instagram'],
            'facebook' => ['url' => 'https://facebook.com/', 'icon' => 'fa-brands fa-facebook'],
            'twitter' => ['url' => 'https://twitter.com/', 'icon' => 'fa-brands fa-x-twitter'],
            'youtube' => ['url' => 'https://youtube.com/', 'icon' => 'fa-brands fa-youtube'],
            'tiktok' => ['url' => 'https://tiktok.com/@', 'icon' => 'fa-brands fa-tiktok'],
            'website' => ['url' => '', 'icon' => 'fa-solid fa-globe'],
        ];

        $class_list = 'melt-social-links melt-social-align-' . esc_attr($align);
        if ($class) {
            $class_list .= ' ' . esc_attr($class);
        }

        $target_attr = $target ? ' target="' . esc_attr($target) . '"' : '';
        $rel_attr = $target === '_blank' ? ' rel="noopener noreferrer"' : '';

        // Include FontAwesome and styles
        $output = $this->get_social_icons_styles();

        $output .= '<div class="' . $class_list . '">';
        $has_links = false;

        foreach ($platforms as $platform => $config) {
            if (!empty($social_media[$platform])) {
                $has_links = true;
                $value = trim($social_media[$platform]);

                // Check if value is already a full URL
                if (preg_match('#^https?://#i', $value)) {
                    // Already a full URL, use as-is
                    $url = $value;
                } elseif ($platform === 'website') {
                    // Website without protocol, add https://
                    $url = 'https://' . $value;
                } else {
                    // Handle only - remove @ if present and prepend base URL
                    $handle = ltrim($value, '@');
                    $url = $config['url'] . $handle;
                }

                $output .= '<a href="' . esc_url($url) . '"' . $target_attr . $rel_attr . ' class="melt-social-link melt-social-' . esc_attr($platform) . '" title="' . esc_attr(ucfirst($platform)) . '">';
                $output .= '<i class="' . esc_attr($config['icon']) . '"></i>';
                $output .= '</a>';
            }
        }

        $output .= '</div>';
        return $has_links ? $output : '';
    }

    /**
     * Get social icons styles and FontAwesome (rendered once per page)
     */
    private function get_social_icons_styles() {
        static $styles_rendered = false;
        if ($styles_rendered) {
            return '';
        }
        $styles_rendered = true;

        return '
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer" />
        <style>
            .melt-social-links {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }
            .melt-social-links.melt-social-align-left { justify-content: flex-start; }
            .melt-social-links.melt-social-align-center { justify-content: center; }
            .melt-social-links.melt-social-align-right { justify-content: flex-end; }
            .melt-social-link {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: #333;
                color: #fff;
                text-decoration: none;
                font-size: 18px;
                transition: background-color 0.2s, transform 0.2s;
            }
            .melt-social-link:hover {
                transform: scale(1.1);
            }
            .melt-social-instagram:hover { background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); }
            .melt-social-facebook:hover { background: #1877f2; }
            .melt-social-twitter:hover { background: #000; }
            .melt-social-youtube:hover { background: #ff0000; }
            .melt-social-tiktok:hover { background: #000; }
            .melt-social-website:hover { background: #0077b5; }
        </style>';
    }

    /**
     * Render gallery with responsive grid/slideshow and lightbox
     */
    private function render_gallery($gallery, $atts = []) {
        if (!is_array($gallery) || empty($gallery)) {
            return '';
        }

        $display = isset($atts['display']) ? $atts['display'] : 'grid';
        $max_images = absint(isset($atts['max_images']) ? $atts['max_images'] : 12);

        // Limit gallery items
        $gallery = array_slice($gallery, 0, $max_images);

        if ($display === 'slideshow') {
            return $this->render_gallery_slideshow($gallery, $atts);
        }

        return $this->render_gallery_grid($gallery, $atts);
    }

    /**
     * Render gallery as grid with lightbox
     */
    private function render_gallery_grid($gallery, $atts = []) {
        // Parse options with defaults
        $class = isset($atts['class']) ? $atts['class'] : '';
        $img_width = absint(isset($atts['img_width']) ? $atts['img_width'] : 100);
        $img_height = absint(isset($atts['img_height']) ? $atts['img_height'] : 100);
        $desktop_cols = absint(isset($atts['desktop_row_count']) ? $atts['desktop_row_count'] : 4);
        $tablet_cols = absint(isset($atts['tablet_row_count']) ? $atts['tablet_row_count'] : 3);
        $mobile_cols = absint(isset($atts['mobile_row_count']) ? $atts['mobile_row_count'] : 2);
        $gap = absint(isset($atts['gap']) ? $atts['gap'] : 0);

        // Generate unique ID for scoped styles
        $gallery_id = 'melt-gallery-' . wp_rand(1000, 9999);

        $class_list = 'melt-gallery ' . $gallery_id;
        if ($class) {
            $class_list .= ' ' . esc_attr($class);
        }

        // Generate responsive CSS and lightbox styles
        $output = '<style>
            .' . $gallery_id . ' {
                display: grid;
                gap: ' . $gap . 'px;
                grid-template-columns: repeat(' . $mobile_cols . ', 1fr);
            }
            .' . $gallery_id . ' .melt-gallery-item {
                margin: 0;
                padding: 0;
                overflow: hidden;
                cursor: pointer;
            }
            .' . $gallery_id . ' .melt-gallery-item img {
                width: ' . $img_width . 'px;
                height: ' . $img_height . 'px;
                object-fit: cover;
                display: block;
                transition: transform 0.2s ease;
            }
            .' . $gallery_id . ' .melt-gallery-item:hover img {
                transform: scale(1.05);
            }
            @media (min-width: 768px) {
                .' . $gallery_id . ' {
                    grid-template-columns: repeat(' . $tablet_cols . ', 1fr);
                }
            }
            @media (min-width: 1024px) {
                .' . $gallery_id . ' {
                    grid-template-columns: repeat(' . $desktop_cols . ', 1fr);
                }
            }
        </style>';

        // Add lightbox styles only once per page
        $output .= $this->get_lightbox_styles();

        $output .= '<div class="' . $class_list . '">';

        foreach ($gallery as $item) {
            $image_url = isset($item['image_url']) ? esc_url($item['image_url']) : '';
            $caption = isset($item['caption']) ? esc_html($item['caption']) : '';

            if ($image_url) {
                $output .= '<figure class="melt-gallery-item" onclick="meltOpenLightbox(\'' . esc_js($image_url) . '\', \'' . esc_js($caption) . '\')">';
                $output .= '<img src="' . $image_url . '" alt="' . esc_attr($caption) . '" title="' . esc_attr($caption) . '">';
                $output .= '</figure>';
            }
        }

        $output .= '</div>';

        // Add lightbox HTML and JS only once per page
        $output .= $this->get_lightbox_html();

        return $output;
    }

    /**
     * Render gallery as slideshow
     */
    private function render_gallery_slideshow($gallery, $atts = []) {
        $class = isset($atts['class']) ? $atts['class'] : '';
        $width = absint(isset($atts['slideshow_width']) ? $atts['slideshow_width'] : 800);
        $height = absint(isset($atts['slideshow_height']) ? $atts['slideshow_height'] : 500);
        $duration = absint(isset($atts['slide_duration']) ? $atts['slide_duration'] : 5000);
        $ken_burns = isset($atts['ken_burns']) && ($atts['ken_burns'] === 'true' || $atts['ken_burns'] === true);

        // Mobile dimensions - fall back to regular dimensions if not set
        $width_mobile = !empty($atts['slideshow_width_mobile']) ? absint($atts['slideshow_width_mobile']) : $width;
        $height_mobile = !empty($atts['slideshow_height_mobile']) ? absint($atts['slideshow_height_mobile']) : $height;

        // Generate unique ID for this slideshow
        $slideshow_id = 'melt-slideshow-' . wp_rand(1000, 9999);

        $class_list = 'melt-slideshow ' . $slideshow_id;
        if ($class) {
            $class_list .= ' ' . esc_attr($class);
        }

        // Ken Burns animation suffix
        $kb_class = $ken_burns ? ' melt-ken-burns' : '';

        $output = $this->get_slideshow_styles();

        // Scoped styles for this slideshow instance
        $output .= '<style>
            .' . $slideshow_id . ' {
                width: ' . $width . 'px;
                height: ' . $height . 'px;
                max-width: 100%;
            }
            .' . $slideshow_id . ' .melt-slideshow-slide img {
                width: ' . $width . 'px;
                height: ' . $height . 'px;
            }
            @media (max-width: 767px) {
                .' . $slideshow_id . ' {
                    width: ' . $width_mobile . 'px;
                    height: ' . $height_mobile . 'px;
                }
                .' . $slideshow_id . ' .melt-slideshow-slide img {
                    width: ' . $width_mobile . 'px;
                    height: ' . $height_mobile . 'px;
                }
            }
        </style>';

        $output .= '<div class="' . $class_list . '" data-duration="' . $duration . '">';
        $output .= '<div class="melt-slideshow-container">';

        $index = 0;
        foreach ($gallery as $item) {
            $image_url = isset($item['image_url']) ? esc_url($item['image_url']) : '';
            $caption = isset($item['caption']) ? esc_html($item['caption']) : '';

            if ($image_url) {
                $active_class = $index === 0 ? ' active' : '';
                $output .= '<div class="melt-slideshow-slide' . $active_class . $kb_class . '" data-index="' . $index . '">';
                $output .= '<img src="' . $image_url . '" alt="' . esc_attr($caption) . '">';
                if ($caption) {
                    $output .= '<div class="melt-slideshow-caption">' . $caption . '</div>';
                }
                $output .= '</div>';
                $index++;
            }
        }

        $output .= '</div>'; // .melt-slideshow-container

        // Navigation arrows
        $output .= '<button class="melt-slideshow-nav melt-slideshow-prev" onclick="meltSlideshowNav(\'' . $slideshow_id . '\', -1)">&#10094;</button>';
        $output .= '<button class="melt-slideshow-nav melt-slideshow-next" onclick="meltSlideshowNav(\'' . $slideshow_id . '\', 1)">&#10095;</button>';

        // Dots navigation
        $output .= '<div class="melt-slideshow-dots">';
        for ($i = 0; $i < $index; $i++) {
            $active_dot = $i === 0 ? ' active' : '';
            $output .= '<span class="melt-slideshow-dot' . $active_dot . '" onclick="meltSlideshowGoto(\'' . $slideshow_id . '\', ' . $i . ')"></span>';
        }
        $output .= '</div>';

        $output .= '</div>'; // .melt-slideshow

        $output .= $this->get_slideshow_scripts();

        return $output;
    }

    /**
     * Get slideshow CSS styles (rendered once per page)
     */
    private function get_slideshow_styles() {
        static $styles_rendered = false;
        if ($styles_rendered) {
            return '';
        }
        $styles_rendered = true;

        return '<style>
            .melt-slideshow {
                position: relative;
                overflow: hidden;
                background: #000;
            }
            .melt-slideshow-container {
                position: relative;
                width: 100%;
                height: 100%;
            }
            .melt-slideshow-slide {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                opacity: 0;
                transition: opacity 1s ease-in-out;
            }
            .melt-slideshow-slide.active {
                opacity: 1;
            }
            .melt-slideshow-slide img {
                object-fit: cover;
                max-width: 100%;
            }
            /* Ken Burns effect */
            .melt-slideshow-slide.melt-ken-burns img {
                animation: meltKenBurns 20s ease-in-out infinite alternate;
                transform-origin: center center;
            }
            .melt-slideshow-slide.melt-ken-burns:nth-child(odd) img {
                animation-name: meltKenBurns1;
            }
            .melt-slideshow-slide.melt-ken-burns:nth-child(even) img {
                animation-name: meltKenBurns2;
            }
            @keyframes meltKenBurns1 {
                0% { transform: scale(1) translate(0, 0); }
                100% { transform: scale(1.2) translate(-3%, -3%); }
            }
            @keyframes meltKenBurns2 {
                0% { transform: scale(1.2) translate(-3%, 3%); }
                100% { transform: scale(1) translate(0, 0); }
            }
            .melt-slideshow-caption {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background: rgba(0, 0, 0, 0.6);
                color: #fff;
                padding: 12px 20px;
                font-size: 14px;
            }
            .melt-slideshow-nav {
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                background: rgba(0, 0, 0, 0.5);
                color: #fff;
                border: none;
                padding: 16px 12px;
                cursor: pointer;
                font-size: 18px;
                transition: background 0.2s;
                z-index: 10;
            }
            .melt-slideshow-nav:hover {
                background: rgba(0, 0, 0, 0.8);
            }
            .melt-slideshow-prev { left: 0; }
            .melt-slideshow-next { right: 0; }
            .melt-slideshow-dots {
                position: absolute;
                bottom: 15px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                gap: 8px;
                z-index: 10;
            }
            .melt-slideshow-dot {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.5);
                cursor: pointer;
                transition: background 0.2s;
            }
            .melt-slideshow-dot:hover,
            .melt-slideshow-dot.active {
                background: #fff;
            }
        </style>';
    }

    /**
     * Get slideshow JavaScript (rendered once per page)
     */
    private function get_slideshow_scripts() {
        static $scripts_rendered = false;
        if ($scripts_rendered) {
            return '';
        }
        $scripts_rendered = true;

        return '<script>
            (function() {
                var slideshowTimers = {};

                function initSlideshow(id) {
                    var slideshow = document.querySelector("." + id);
                    if (!slideshow) return;

                    var duration = parseInt(slideshow.getAttribute("data-duration")) || 5000;
                    startSlideshowTimer(id, duration);
                }

                function startSlideshowTimer(id, duration) {
                    if (slideshowTimers[id]) {
                        clearInterval(slideshowTimers[id]);
                    }
                    slideshowTimers[id] = setInterval(function() {
                        meltSlideshowNav(id, 1);
                    }, duration);
                }

                window.meltSlideshowNav = function(id, direction) {
                    var slideshow = document.querySelector("." + id);
                    if (!slideshow) return;

                    var slides = slideshow.querySelectorAll(".melt-slideshow-slide");
                    var dots = slideshow.querySelectorAll(".melt-slideshow-dot");
                    var current = slideshow.querySelector(".melt-slideshow-slide.active");
                    var currentIndex = current ? parseInt(current.getAttribute("data-index")) : 0;
                    var newIndex = currentIndex + direction;

                    if (newIndex >= slides.length) newIndex = 0;
                    if (newIndex < 0) newIndex = slides.length - 1;

                    slides.forEach(function(s) { s.classList.remove("active"); });
                    dots.forEach(function(d) { d.classList.remove("active"); });
                    slides[newIndex].classList.add("active");
                    if (dots[newIndex]) dots[newIndex].classList.add("active");

                    // Reset timer
                    var duration = parseInt(slideshow.getAttribute("data-duration")) || 5000;
                    startSlideshowTimer(id, duration);
                };

                window.meltSlideshowGoto = function(id, index) {
                    var slideshow = document.querySelector("." + id);
                    if (!slideshow) return;

                    var slides = slideshow.querySelectorAll(".melt-slideshow-slide");
                    var dots = slideshow.querySelectorAll(".melt-slideshow-dot");

                    slides.forEach(function(s) { s.classList.remove("active"); });
                    dots.forEach(function(d) { d.classList.remove("active"); });
                    if (slides[index]) slides[index].classList.add("active");
                    if (dots[index]) dots[index].classList.add("active");

                    // Reset timer
                    var duration = parseInt(slideshow.getAttribute("data-duration")) || 5000;
                    startSlideshowTimer(id, duration);
                };

                // Initialize all slideshows on page load
                document.addEventListener("DOMContentLoaded", function() {
                    document.querySelectorAll(".melt-slideshow").forEach(function(el) {
                        var classes = el.className.split(" ");
                        for (var i = 0; i < classes.length; i++) {
                            if (classes[i].indexOf("melt-slideshow-") === 0) {
                                initSlideshow(classes[i]);
                                break;
                            }
                        }
                    });
                });
            })();
        </script>';
    }

    /**
     * Get lightbox CSS styles (rendered once per page)
     */
    private function get_lightbox_styles() {
        static $styles_rendered = false;
        if ($styles_rendered) {
            return '';
        }
        $styles_rendered = true;

        return '<style>
            .melt-lightbox {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                z-index: 999999;
                justify-content: center;
                align-items: center;
                flex-direction: column;
            }
            .melt-lightbox.active {
                display: flex;
            }
            .melt-lightbox-close {
                position: absolute;
                top: 20px;
                right: 30px;
                font-size: 40px;
                color: #fff;
                cursor: pointer;
                z-index: 1000000;
                line-height: 1;
                opacity: 0.8;
                transition: opacity 0.2s;
            }
            .melt-lightbox-close:hover {
                opacity: 1;
            }
            .melt-lightbox-content {
                max-width: 90%;
                max-height: 85%;
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            .melt-lightbox-content img {
                max-width: 100%;
                max-height: 80vh;
                object-fit: contain;
            }
            .melt-lightbox-caption {
                color: #fff;
                text-align: center;
                padding: 15px;
                font-size: 14px;
                max-width: 600px;
            }
        </style>';
    }

    /**
     * Get lightbox HTML and JavaScript (rendered once per page)
     */
    private function get_lightbox_html() {
        static $html_rendered = false;
        if ($html_rendered) {
            return '';
        }
        $html_rendered = true;

        return '
        <div class="melt-lightbox" id="melt-lightbox" onclick="meltCloseLightbox(event)">
            <span class="melt-lightbox-close" onclick="meltCloseLightbox(event)">&times;</span>
            <div class="melt-lightbox-content" onclick="event.stopPropagation()">
                <img id="melt-lightbox-img" src="" alt="">
                <div class="melt-lightbox-caption" id="melt-lightbox-caption"></div>
            </div>
        </div>
        <script>
            function meltOpenLightbox(src, caption) {
                var lightbox = document.getElementById("melt-lightbox");
                var img = document.getElementById("melt-lightbox-img");
                var captionEl = document.getElementById("melt-lightbox-caption");
                img.src = src;
                captionEl.textContent = caption || "";
                captionEl.style.display = caption ? "block" : "none";
                lightbox.classList.add("active");
                document.body.style.overflow = "hidden";
            }
            function meltCloseLightbox(event) {
                if (event) {
                    event.stopPropagation();
                }
                var lightbox = document.getElementById("melt-lightbox");
                lightbox.classList.remove("active");
                document.body.style.overflow = "";
            }
            document.addEventListener("keydown", function(e) {
                if (e.key === "Escape") {
                    meltCloseLightbox();
                }
            });
        </script>';
    }

    /**
     * Render releases list
     */
    private function render_releases($releases, $class = '') {
        if (!is_array($releases) || empty($releases)) {
            return '';
        }

        $class_attr = $class ? ' class="' . esc_attr($class) . '"' : ' class="melt-releases"';
        $output = '<ul' . $class_attr . '>';

        foreach ($releases as $release) {
            $title = isset($release['title']) ? esc_html($release['title']) : '';
            $type = isset($release['release_type']) ? esc_html($release['release_type']) : '';
            $releaseDate = isset($release['release_date']) ? esc_html($release['release_date']) : '';
            $artwork = isset($release['cover_art_url']) ? esc_url($release['cover_art_url']) : '';
            $description = isset($release['description']) ? esc_html($release['description']) : '';

            $output .= '<li class="melt-release">';
            if ($artwork) {
                $output .= '<img src="' . $artwork . '" alt="' . esc_attr($title) . '" class="melt-release-artwork">';
            }
            $output .= '<div class="melt-release-info">';
            $output .= '<span class="melt-release-title">' . $title . '</span>';
            if ($type) {
                $output .= ' <span class="melt-release-type">(' . $type . ')</span>';
            }
            if ($releaseDate) {
                $output .= ' <span class="melt-release-date">' . $releaseDate . '</span>';
            }

            // Render streaming links if available
            if (!empty($release['streaming_links'])) {
                $links = $release['streaming_links'];
                $streaming_output = '';

                if (!empty($links['spotify'])) {
                    $streaming_output .= '<a href="' . esc_url($links['spotify']) . '" class="melt-streaming-link melt-spotify" target="_blank" rel="noopener noreferrer">Spotify</a> ';
                }
                if (!empty($links['apple_music'])) {
                    $streaming_output .= '<a href="' . esc_url($links['apple_music']) . '" class="melt-streaming-link melt-apple-music" target="_blank" rel="noopener noreferrer">Apple Music</a> ';
                }
                if (!empty($links['youtube'])) {
                    $streaming_output .= '<a href="' . esc_url($links['youtube']) . '" class="melt-streaming-link melt-youtube" target="_blank" rel="noopener noreferrer">YouTube</a> ';
                }

                if ($streaming_output) {
                    $output .= '<div class="melt-streaming-links">' . $streaming_output . '</div>';
                }
            }

            $output .= '</div>';
            $output .= '</li>';
        }

        $output .= '</ul>';
        return $output;
    }

    /**
     * Render error message (only visible to admins)
     */
    private function render_error($message) {
        if (current_user_can('manage_options')) {
            return '<span class="melt-dashboard-error" style="color: red;">[Melt Dashboard Error: ' . esc_html($message) . ']</span>';
        }
        return '';
    }
}

// Initialize the plugin
MeltDashboardPlugin::get_instance();
