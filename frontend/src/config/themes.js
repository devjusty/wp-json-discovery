export const SUPPORTED_THEMES = [
  {
    id: 'twentytwentyfour',
    label: 'Twenty Twenty-Four',
    description: 'Block-first default theme with pattern-heavy templates.',
    themeUrl: 'https://wordpress.org/themes/twentytwentyfour/',
    signals: ['wp_theme=twentytwentyfour', '/wp-content/themes/twentytwentyfour']
  },
  {
    id: 'astra',
    label: 'Astra',
    description: 'Lightweight multipurpose theme popular with Elementor and Beaver Builder.',
    themeUrl: 'https://wordpress.org/themes/astra/',
    signals: ['astra-theme-css', '/wp-content/themes/astra']
  },
  {
    id: 'hello-elementor',
    label: 'Hello Elementor',
    description: 'Minimal base theme shipped with Elementor for full control over templates.',
    themeUrl: 'https://wordpress.org/themes/hello-elementor/',
    signals: ['/wp-content/themes/hello-elementor']
  },
  {
    id: 'generatepress',
    label: 'GeneratePress',
    description: 'Performance-focused theme often paired with GenerateBlocks.',
    themeUrl: 'https://wordpress.org/themes/generatepress/',
    signals: ['/wp-content/themes/generatepress']
  },
  {
    id: 'divi',
    label: 'Divi',
    description: 'Elegant Themes’ builder theme with visual editor and layout packs.',
    themeUrl: 'https://www.elegantthemes.com/gallery/divi/',
    signals: ['/wp-content/themes/Divi', 'divi-builder-version']
  },
  {
    id: 'kadence',
    label: 'Kadence',
    description: 'Kadence WP theme with lightweight defaults and design library.',
    themeUrl: 'https://www.kadencewp.com/kadence-theme/',
    signals: ['/wp-content/themes/kadence', 'kadence-theme']
  },
  {
    id: 'greenshift-theme',
    label: 'Greenshift Theme',
    description: 'Companion theme for Greenshift’s animation and block toolkit.',
    themeUrl: 'https://greenshiftwp.com/',
    signals: ['/wp-content/themes/greenshift']
  },
  {
    id: 'shakti',
    label: 'Shakti',
    description: 'ThemeREX Shakti theme and common child-theme variant.',
    themeUrl: 'https://themeforest.net/item/shakti-ayurveda-yoga-and-spa-wordpress-theme/44356518',
    signals: ['/wp-content/themes/shakti', '/wp-content/themes/shakti-child']
  },
  {
    id: 'generatepress-child',
    label: 'GeneratePress Child',
    description: 'Child themes based on GeneratePress.',
    themeUrl: 'https://generatepress.com/',
    signals: ['/wp-content/themes/generatepress_child']
  },
  {
    id: 'the7',
    label: 'The7',
    description: 'The7 multipurpose theme by Dream-Theme.',
    themeUrl: 'https://themeforest.net/item/the7-responsive-multipurpose-wordpress-theme/5556590',
    signals: ['/wp-content/themes/dt-the7']
  },
  {
    id: 'the7-child',
    label: 'The7 Child',
    description: 'Child themes based on The7.',
    themeUrl: 'https://themeforest.net/item/the7-responsive-multipurpose-wordpress-theme/5556590',
    signals: ['/wp-content/themes/dt-the7-child', '/wp-content/themes/davanis']
  }
];
