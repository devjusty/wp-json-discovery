export const SUPPORTED_PLUGINS = [
  {
    id: 'woocommerce',
    label: 'WooCommerce',
    description: 'Product, cart, and store endpoints exposed by WooCommerce.',
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
    namespaces: ['aioseo/v1']
  },
  {
    id: 'yoast',
    label: 'Yoast SEO',
    description: 'Metadata and analysis endpoints from Yoast SEO.',
    namespaces: ['yoast/v1', 'yoast/v2']
  },
  {
    id: 'cookieyes',
    label: 'CookieYes',
    description: 'Consent banner and policy endpoints from CookieYes / GDPR Cookie Consent.',
    namespaces: ['cky/v1']
  },
  {
    id: 'contact-form-7',
    label: 'Contact Form 7',
    description: 'Form listings and submissions exposed publicly.',
    namespaces: ['contact-form-7/v1']
  },
  {
    id: 'ninja-forms',
    label: 'Ninja Forms',
    description: 'Public submission and view routes provided by Ninja Forms.',
    namespaces: ['ninja-forms-submissions', 'ninja-forms-views']
  },
  {
    id: 'jetpack',
    label: 'Jetpack',
    description: 'Public Jetpack site endpoints.',
    namespaces: ['jetpack/v4']
  },
  {
    id: 'acf',
    label: 'Advanced Custom Fields',
    description: 'Advanced Custom Fields (ACF) REST routes.',
    namespaces: ['acf/v3']
  },
  {
    id: 'gravityforms',
    label: 'Gravity Forms',
    description: 'Read-only Gravity Forms endpoints (if exposed).',
    namespaces: ['gf/v2']
  },
  {
    id: 'wp-recipe-maker',
    label: 'WP Recipe Maker',
    description: 'Recipe management endpoints surfaced by WP Recipe Maker.',
    namespaces: ['wp-recipe-maker/v1']
  },
  {
    id: 'elementor',
    label: 'Elementor',
    description: 'Page builder REST endpoints for Elementor templates and data.',
    namespaces: ['elementor/v1']
  },
  {
    id: 'wpforms',
    label: 'WPForms',
    description: 'WPForms form listings and submission endpoints.',
    namespaces: ['wpforms/v1']
  },
  {
    id: 'rank-math',
    label: 'Rank Math SEO',
    description: 'Rank Math SEO analysis and schema endpoints.',
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
    namespaces: ['wp-super-cache/v1']
  },
  {
    id: 'regenerate-thumbnails',
    label: 'Regenerate Thumbnails',
    description: 'REST helpers exposed by Regenerate Thumbnails.',
    namespaces: ['regenerate-thumbnails/v1']
  },
  {
    id: 'wordfence',
    label: 'Wordfence',
    description: 'Security endpoints from the Wordfence firewall plugin.',
    namespaces: ['wordfence/v1']
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
    namespaces: ['cleantalk-antispam/v1']
  },
  {
    id: 'popup-maker',
    label: 'Popup Maker',
    description: 'Popup Maker configuration routes.',
    namespaces: ['pum/v1']
  },
  {
    id: 'redirection',
    label: 'Redirection',
    description: 'Redirection plugin API exposing redirect rules.',
    namespaces: ['redirection/v1']
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
    namespaces: ['health-check/v1']
  },
  {
    id: 'litespeed-cache',
    label: 'LiteSpeed Cache',
    description: 'LiteSpeed Cache API endpoints for cache management.',
    namespaces: ['litespeed/v1', 'litespeed/v3']
  },
  {
    id: 'modern-events-calendar',
    label: 'Modern Events Calendar',
    description: 'Modern Events Calendar (MEC) public REST endpoints.',
    namespaces: ['mec/v1']
  },
  {
    id: 'yabe-webfont',
    label: 'Yabe Webfont',
    description: 'Yabe Webfont service endpoints exposed via REST.',
    namespaces: ['yabe-webfont/v1']
  }
];

export const CORE_NAMESPACES = [
  'wp/v2',
  'oembed/1.0',
  'wp-site-health/v1'
];
