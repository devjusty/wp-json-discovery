/**
 * @file Configuration constants for the WP JSON Discovery server.
 */

/**
 * Default timeout for HTTP requests in milliseconds.
 * @type {number}
 */
export const REQUEST_TIMEOUT_MS = 15000;

/**
 * Maximum size of the homepage HTML body to process, in bytes (1 MB).
 * @type {number}
 */
export const HOMEPAGE_HTML_CAP_BYTES = 1024 * 1024;

/**
 * Default User-Agent string for outgoing HTTP requests.
 * A generic user agent is used to avoid identifying the discovery tool specifically.
 * @type {string}
 */
export const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

/**
 * Maximum number of pages to scan from a sitemap.
 * @type {number}
 */
export const MAX_SITEMAP_PAGES = 50;

/**
 * Maximum size of a page body to process during sitemap scanning, in bytes (1.5 MB).
 * @type {number}
 */
export const MAX_PAGE_BODY_BYTES = 1.5 * 1024 * 1024;

/**
 * Timeout for individual page fetches during sitemap scanning, in milliseconds.
 * Prevents a single slow/hung page from stalling the entire scan.
 * @type {number}
 */
export const PAGE_FETCH_TIMEOUT_MS = 10000;

/**
 * Maximum number of sitemap pages to fetch concurrently.
 * Balances speed against load on the target server.
 * @type {number}
 */
export const SITEMAP_PAGE_CONCURRENCY = 5;

/**
 * Maximum number of child sitemaps to follow from a sitemap index.
 * @type {number}
 */
export const MAX_CHILD_SITEMAPS = 10;

/**
 * Default origin for the frontend application, used for CORS configuration.
 * @type {string}
 */
export const FRONTEND_ORIGIN_DEFAULT = 'http://localhost:5173';

/**
 * List of headers to be exposed to the frontend client.
 * These headers provide additional information about the upstream response.
 * @type {string[]}
 */
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

/**
 * List of headers to be forwarded from the upstream response to the client.
 * These are a subset of EXPOSED_HEADERS_LIST.
 * @type {string[]}
 */
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

/**
 * Pruning defaults for activity logs.
 * keepLatest: how many most recent rows to retain.
 * olderThanDays: prune anything older than this many days (if set).
 */
export const ACTIVITY_LOG_PRUNE_DEFAULTS = {
  keepLatest: 500,
  olderThanDays: 21
};
