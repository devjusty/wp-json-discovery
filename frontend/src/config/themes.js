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
  }
];
