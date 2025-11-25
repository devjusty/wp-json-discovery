export const SUPPORTED_PLUGINS = [
  {
    id: 'woocommerce',
    label: 'WooCommerce',
    description: 'Product, cart, and store endpoints exposed by WooCommerce.',
    pluginUrl: 'https://wordpress.org/plugins/woocommerce/',
    namespaces: [
      'wc/v1',
      'wc/v2',
      'wc/v3',
      'wc/store/v1',
      'wc/store',
      'wc/private',
      'wc-admin',
      'wc-admin-email',
      'wc-analytics',
      'wc-telemetry',
      'wccom-site/v3'
    ]
  },
  {
    id: 'aioseo',
    label: 'All in One SEO',
    description: 'SEO analysis and sitemap endpoints exposed by All in One SEO.',
    pluginUrl: 'https://wordpress.org/plugins/all-in-one-seo-pack/',
    namespaces: ['aioseo/v1']
  },
  {
    id: 'yoast',
    label: 'Yoast SEO',
    description: 'Metadata and analysis endpoints from Yoast SEO.',
    pluginUrl: 'https://wordpress.org/plugins/wordpress-seo/',
    namespaces: ['yoast/v1', 'yoast/v2']
  },
  {
    id: 'cookieyes',
    label: 'CookieYes',
    description: 'Consent banner and policy endpoints from CookieYes / GDPR Cookie Consent.',
    pluginUrl: 'https://wordpress.org/plugins/cookie-law-info/',
    namespaces: ['cky/v1']
  },
  {
    id: 'contact-form-7',
    label: 'Contact Form 7',
    description: 'Form listings and submissions exposed publicly.',
    pluginUrl: 'https://wordpress.org/plugins/contact-form-7/',
    namespaces: ['contact-form-7/v1']
  },
  {
    id: 'ninja-forms',
    label: 'Ninja Forms',
    description: 'Public submission and view routes provided by Ninja Forms.',
    pluginUrl: 'https://wordpress.org/plugins/ninja-forms/',
    namespaces: ['ninja-forms-submissions', 'ninja-forms-views']
  },
  {
    id: 'jetpack',
    label: 'Jetpack',
    description: 'Public Jetpack site endpoints.',
    pluginUrl: 'https://wordpress.org/plugins/jetpack/',
    namespaces: [
      'jetpack/v4',
      'jetpack-boost/v1',
      'jetpack-global-styles/v1',
      'jetpack/v4/blaze',
      'jetpack/v4/blaze-app',
      'jetpack/v4/explat',
      'jetpack/v4/import',
      'jetpack/v4/stats-app',
      'my-jetpack/v1',
      'newspack-blocks/v1',
      'videopress/v1',
      'wpcom/v2',
      'wpcom/v3',
      'wpcomsh/v1'
    ]
  },
  {
    id: 'acf',
    label: 'Advanced Custom Fields',
    description: 'Advanced Custom Fields (ACF) REST routes.',
    pluginUrl: 'https://wordpress.org/plugins/advanced-custom-fields/',
    namespaces: ['acf/v3']
  },
  {
    id: 'pods',
    label: 'Pods Framework',
    description: 'Custom content type endpoints exposed by the Pods framework.',
    pluginUrl: 'https://wordpress.org/plugins/pods/',
    namespaces: ['pods/v1']
  },
  {
    id: 'gravityforms',
    label: 'Gravity Forms',
    description: 'Read-only Gravity Forms endpoints (if exposed).',
    namespaces: ['gf/v2']
  },
  {
    id: 'greenshift',
    label: 'Greenshift',
    description: 'Page and animation builder for Gutenberg.',
    pluginUrl: 'https://wordpress.org/plugins/greenshift-animation-and-page-builder-blocks/',
    namespaces: [
      'greenshift/v1',
      'greenshifttheme/v1'
    ]
  },
  {
    id: 'google-site-kit',
    label: 'Google Site Kit',
    description: 'Official Google plugin to connect Google services like Analytics and Search Console.',
    pluginUrl: 'https://wordpress.org/plugins/google-site-kit/',
    namespaces: ['google-site-kit/v1']
  },
  {
    id: 'wp-recipe-maker',
    label: 'WP Recipe Maker',
    description: 'Recipe management endpoints surfaced by WP Recipe Maker.',
    pluginUrl: 'https://wordpress.org/plugins/wp-recipe-maker/',
    namespaces: ['wp-recipe-maker/v1']
  },
  {
    id: 'elementor',
    label: 'Elementor',
    description: 'Page builder REST endpoints for Elementor templates and data.',
    pluginUrl: 'https://wordpress.org/plugins/elementor/',
    namespaces: ['elementor/v1', 'elementor/v1/documents']
  },
  {
    id: 'elementor-ai',
    label: 'Elementor AI',
    description: 'AI assistant features exposed via Elementor cloud endpoints.',
    namespaces: ['elementor-ai/v1']
  },
  {
    id: 'elementor-hello-elementor',
    label: 'Hello Elementor Theme',
    description: 'Theme onboarding endpoints bundled with Hello Elementor.',
    pluginUrl: 'https://wordpress.org/themes/hello-elementor/',
    namespaces: ['elementor-hello-elementor/v1']
  },
  {
    id: 'elementor-pro',
    label: 'Elementor Pro',
    description: 'Pro-only Elementor REST endpoints for advanced widgets.',
    namespaces: ['elementor-pro/v1']
  },
  {
    id: 'elementskit',
    label: 'ElementsKit',
    description: 'ElementsKit widget, menu, and template helper routes.',
    pluginUrl: 'https://wordpress.org/plugins/elementskit-lite/',
    namespaces: [
      'elementskit/v1/ajaxselect2',
      'elementskit/v1/dynamic-content',
      'elementskit/v1/layout-manager-api',
      'elementskit/v1/megamenu',
      'elementskit/v1/my-template',
      'elementskit/v1/widget/mailchimp'
    ]
  },
  {
    id: 'template-kit-import',
    label: 'Template Kit Import',
    description: 'Elementor template kit import/export REST endpoints.',
    pluginUrl: 'https://wordpress.org/plugins/template-kit-import/',
    namespaces: ['template-kit-import/v2']
  },
  {
    id: 'wpforms',
    label: 'WPForms',
    description: 'WPForms form listings and submission endpoints.',
    pluginUrl: 'https://wordpress.org/plugins/wpforms-lite/',
    namespaces: ['wpforms/v1']
  },
  {
    id: 'fluentform',
    label: 'Fluent Forms',
    description: 'Fluent Forms submissions and automation routes.',
    pluginUrl: 'https://wordpress.org/plugins/fluentform/',
    namespaces: ['fluentform/v1']
  },
  {
    id: 'rank-math',
    label: 'Rank Math SEO',
    description: 'Rank Math SEO analysis and schema endpoints.',
    pluginUrl: 'https://wordpress.org/plugins/seo-by-rank-math/',
    namespaces: [
      'rankmath/v1',
      'rankmath/v1/an',
      'rankmath/v1/in',
      'rankmath/v1/status',
      'rankmath/v1/setupWizard'
    ]
  },
  {
    id: 'seopress',
    label: 'SEOPress',
    description: 'SEOPress metadata and sitemap routes.',
    pluginUrl: 'https://wordpress.org/plugins/wp-seopress/',
    namespaces: ['seopress/v1', 'seopress/v2']
  },
  {
    id: 'learndash',
    label: 'LearnDash LMS',
    description: 'Course and lesson endpoints exposed by LearnDash LMS.',
    namespaces: ['ldlms/v1']
  },
  {
    id: 'memberpress',
    label: 'MemberPress',
    description: 'Membership management endpoints provided by MemberPress.',
    namespaces: ['memberpress/v1']
  },
  {
    id: 'wp-super-cache',
    label: 'WP Super Cache',
    description: 'Cache status endpoints provided by WP Super Cache.',
    pluginUrl: 'https://wordpress.org/plugins/wp-super-cache/',
    namespaces: ['wp-super-cache/v1']
  },
  {
    id: 'wp-rocket',
    label: 'WP Rocket',
    description: 'WP Rocket cache control and diagnostics endpoints.',
    namespaces: ['wp-rocket/v1']
  },
  {
    id: 'regenerate-thumbnails',
    label: 'Regenerate Thumbnails',
    description: 'REST helpers exposed by Regenerate Thumbnails.',
    pluginUrl: 'https://wordpress.org/plugins/regenerate-thumbnails/',
    namespaces: ['regenerate-thumbnails/v1']
  },
  {
    id: 'akismet',
    label: 'Akismet Anti-Spam',
    description: 'Akismet spam detection and diagnostics endpoints.',
    pluginUrl: 'https://wordpress.org/plugins/akismet/',
    namespaces: ['akismet/v1']
  },
  {
    id: 'wordfence',
    label: 'Wordfence',
    description: 'Security endpoints from the Wordfence firewall plugin.',
    pluginUrl: 'https://wordpress.org/plugins/wordfence/',
    namespaces: ['wordfence/v1']
  },
  {
    id: 'two-factor',
    label: 'Two-Factor Authentication',
    description: 'Two-Factor plugin verification and device routes.',
    pluginUrl: 'https://wordpress.org/plugins/two-factor/',
    namespaces: ['two-factor/1.0']
  },
  {
    id: 'monsterinsights',
    label: 'MonsterInsights',
    description: 'Google Analytics reporting endpoints from MonsterInsights.',
    pluginUrl: 'https://wordpress.org/plugins/google-analytics-for-wordpress/',
    namespaces: ['monsterinsights/v1']
  },
  {
    id: 'wp-block-editor',
    label: 'Block Editor',
    description: 'Block editor support routes registered by Gutenberg / core block editor.',
    namespaces: ['wp-block-editor/v1']
  },
  {
    id: 'cleantalk-antispam',
    label: 'CleanTalk Anti-Spam',
    description: 'CleanTalk anti-spam diagnostics endpoints.',
    pluginUrl: 'https://wordpress.org/plugins/cleantalk-spam-protect/',
    namespaces: ['cleantalk-antispam/v1']
  },
  {
    id: 'popup-maker',
    label: 'Popup Maker',
    description: 'Popup Maker configuration routes.',
    pluginUrl: 'https://wordpress.org/plugins/popup-maker/',
    namespaces: ['pum/v1']
  },
  {
    id: 'redirection',
    label: 'Redirection',
    description: 'Redirection plugin API exposing redirect rules.',
    pluginUrl: 'https://wordpress.org/plugins/redirection/',
    namespaces: ['redirection/v1']
  },
  {
    id: 'link-whisper',
    label: 'Link Whisper',
    description: 'Link Whisper internal linking automation routes.',
    namespaces: ['link-whisper']
  },
  {
    id: 'flywheel',
    label: 'Flywheel Site Management',
    description: 'Managed hosting diagnostics exposed by Flywheel.',
    namespaces: ['flywheel/v1']
  },
  {
    id: 'hub-connector',
    label: 'Hub Connector',
    description: 'Flywheel Hub connector routes used for remote actions.',
    namespaces: ['hub-connector/v1']
  },
  {
    id: 'nps-survey',
    label: 'NPS Survey',
    description: 'Net Promoter Score survey submission endpoints.',
    namespaces: ['nps-survey/v1']
  },
  {
    id: 'wp-engine-advanced-network',
    label: 'WP Engine Advanced Network',
    description: 'Advanced Network cache and diagnostics endpoints on WP Engine.',
    namespaces: ['wpe/v1', 'wpe-site/v1']
  },
  {
    id: 'wp-engine',
    label: 'WP Engine Tools',
    description: 'WP Engine MU plugins for cache control and single sign-on.',
    namespaces: ['wpe/cache-plugin/v1', 'wpe_sign_on_plugin/v1']
  },
  {
    id: 'divi-builder',
    label: 'Divi Builder',
    description: 'Divi Builder REST endpoints for layouts and modules.',
    namespaces: ['divi/v1']
  },
  {
    id: 'health-check',
    label: 'Health Check',
    description: 'Site Health diagnostic endpoints from the Health Check plugin.',
    pluginUrl: 'https://wordpress.org/plugins/health-check/',
    namespaces: ['health-check/v1']
  },
  {
    id: 'hostinger',
    label: 'Hostinger',
    description: 'Plugins provided by Hostinger for site management, AI, and analytics.',
    namespaces: [
      'hostinger-affiliate-plugin/v1',
      'hostinger-amplitude/v1',
      'hostinger-tools-plugin/v1',
      'hostinger-easy-onboarding/v1',
      'hostinger-ai-assistant/v1'
    ]
  },
  {
    id: 'instant-images',
    label: 'Instant Images',
    description: 'Directly upload images from Unsplash, Pixabay, and Pexels.',
    pluginUrl: 'https://wordpress.org/plugins/instant-images/',
    namespaces: ['instant-images']
  },
  {
    id: 'litespeed-cache',
    label: 'LiteSpeed Cache',
    description: 'LiteSpeed Cache API endpoints for cache management.',
    pluginUrl: 'https://wordpress.org/plugins/litespeed-cache/',
    namespaces: ['litespeed/v1', 'litespeed/v3']
  },
  {
    id: 'modern-events-calendar',
    label: 'Modern Events Calendar',
    description: 'Modern Events Calendar (MEC) public REST endpoints.',
    pluginUrl: 'https://wordpress.org/plugins/modern-events-calendar-lite/',
    namespaces: ['mec/v1']
  },
  {
    id: 'ultimate-addons-vc',
    label: 'Ultimate Addons for VC',
    description: 'Ultimate Addons for WPBakery/VC widget endpoints.',
    namespaces: ['uavc/v1', 'ultimate-vc/v1']
  },
  {
    id: 'wp-smush',
    label: 'WP Smush',
    description: 'Smush image optimization and CDN diagnostic routes.',
    pluginUrl: 'https://wordpress.org/plugins/wp-smushit/',
    namespaces: ['wp-smush/v1']
  },
  {
    id: 'wpmudev-blc',
    label: 'WPMU DEV Broken Link Checker',
    description: 'Broken Link Checker batch endpoints from WPMU DEV.',
    namespaces: ['wpmudev_blc/v1']
  },
  {
    id: 'wpmudev-pcs',
    label: 'WPMU DEV Performance',
    description: 'Performance check service endpoints provided by WPMU DEV.',
    namespaces: ['wpmudev_pcs/v1']
  },
  {
    id: 'exactmetrics',
    label: 'ExactMetrics',
    description: 'ExactMetrics analytics summary and reports API.',
    pluginUrl: 'https://wordpress.org/plugins/google-analytics-dashboard-for-wp/',
    namespaces: ['exactmetrics/v1']
  },
  {
    id: 'fluent-smtp',
    label: 'FluentSMTP',
    description: 'FluentSMTP email delivery status endpoints.',
    pluginUrl: 'https://wordpress.org/plugins/fluent-smtp/',
    namespaces: ['fluent-smtp']
  },
  {
    id: 'search-regex',
    label: 'Search Regex',
    description: 'Search Regex search/replace automation routes.',
    pluginUrl: 'https://wordpress.org/plugins/search-regex/',
    namespaces: ['search-regex/v1']
  },
  {
    id: 'slider-revolution',
    label: 'Slider Revolution',
    description: 'Slider Revolution slider import/export endpoints.',
    namespaces: ['sliderrevolution']
  },
  {
    id: 'userway',
    label: 'UserWay Accessibility',
    description: 'UserWay accessibility widget configuration routes.',
    pluginUrl: 'https://wordpress.org/plugins/userway-accessibility-widget/',
    namespaces: ['userway/v1']
  },
  {
    id: 'wp-mail-smtp',
    label: 'WP Mail SMTP',
    description: 'Email configuration and diagnostic endpoints from WP Mail SMTP.',
    pluginUrl: 'https://wordpress.org/plugins/wp-mail-smtp/',
    namespaces: ['wp-mail-smtp/v1']
  },
  {
    id: 'slim-seo',
    label: 'Slim SEO',
    description: 'Lightweight SEO plugin endpoints, including redirection module.',
    pluginUrl: 'https://wordpress.org/plugins/slim-seo/',
    namespaces: ['slim-seo', 'slim-seo-redirection']
  },
  {
    id: 'gtmkit',
    label: 'GTM Kit',
    description: 'Google Tag Manager Kit endpoints for WP.',
    pluginUrl: 'https://wordpress.org/plugins/gtm-kit/',
    namespaces: ['gtmkit/v1']
  },
  {
    id: 'formidable',
    label: 'Formidable Forms',
    description: 'Formidable Forms admin REST helpers.',
    pluginUrl: 'https://wordpress.org/plugins/formidable/',
    namespaces: ['frm-admin/v1']
  },
  {
    id: 'divitorque-lite',
    label: 'Divi Torque Lite',
    description: 'Divi Torque Lite REST endpoints.',
    namespaces: ['divitorque-lite/v1']
  },
  {
    id: 'yabe-webfont',
    label: 'Yabe Webfont',
    description: 'Yabe Webfont service endpoints exposed via REST.',
    namespaces: ['yabe-webfont/v1']
  },
  {
    id: 'the-events-calendar',
    label: 'The Events Calendar',
    description: 'Modern Tribe event and calendar management routes.',
    pluginUrl: 'https://wordpress.org/plugins/the-events-calendar/',
    namespaces: [
      'tec/v1',
      'tec/v2/onboarding',
      'tribe/event-aggregator/v1',
      'tribe/events/v1',
      'tribe/views/v2'
    ]
  }
];

export const CORE_NAMESPACES = [
  'wp/v2',
  'oembed/1.0',
  'wp-site-health/v1'
];
