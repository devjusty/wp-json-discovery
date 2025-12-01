export const REQUEST_TIMEOUT_MS = 15000;
export const HOMEPAGE_HTML_CAP_BYTES = 1024 * 1024; // 1 MB
export const DEFAULT_USER_AGENT = 'wp-json-discovery/0.0.1 (+https://github.com/justinthompson/wp-json-discovery)';
export const MAX_SITEMAP_PAGES = 50;
export const MAX_PAGE_BODY_BYTES = 1.5 * 1024 * 1024; // 1.5 MB

export const FRONTEND_ORIGIN_DEFAULT = 'http://localhost:5173';

export const EXPOSED_HEADERS_LIST = [
  'x-wp-total',
  'x-wp-totalpages',
  'link',
  'server',
  'x-powered-by',
  'x-cache',
  'x-cache-status',
  'x-proxy-cache',
  'x-litespeed-cache',
  'cf-ray',
  'age',
  'cache-control',
  'vary',
  'location',
  'x-wpjd-final-url',
  'x-wpjd-redirects',
  'x-wpjd-upstream-status',
  'x-wpjd-upstream-duration'
];

export const FORWARDED_RESPONSE_HEADERS_LIST = [
  'x-wp-total',
  'x-wp-totalpages',
  'link',
  'server',
  'x-powered-by',
  'x-cache',
  'x-cache-status',
  'x-proxy-cache',
  'x-litespeed-cache',
  'cf-ray',
  'age',
  'cache-control',
  'vary',
  'location',
  'x-wpjd-final-url',
  'x-wpjd-redirects'
];