# TODO List

This list tracks potential improvements and bug fixes for the `wp-json-discovery` application.

## Backend (`server/src/index.js`)

### Backend High Priority

- [x] **Code Organization:** Refactor `server/src/index.js` by moving helper functions (`fetchWithRedirects`, `loadEnvFile`, `readBodyWithLimit`, `extract...` functions, etc.) into separate utility modules.
- [ ] **Error Handling:** Implement a consistent error handling and logging strategy across the backend.
- [ ] **Input Validation:** Improve input validation for all API endpoints to prevent potential security vulnerabilities.
- [x] **HTML Parsing:** Replace regex-based HTML parsing with a more robust library like `cheerio` or `jsdom`.

### Backend Medium Priority

- [x] **Promise Rejections:** Add more robust error handling to the `withPluginsLock` promise queue to prevent silent failures.
- [x] **Configuration:** Move hardcoded values (e.g., timeouts, user-agent strings) to environment variables or a dedicated configuration file.

### Backend Low Priority

- [x] **Code Duplication:** Refactor to avoid redundant calls to `sanitizeDomain`.
- [x] **Large Functions:** Break down large functions like the `/api/sitemap-scan` handler into smaller, more manageable functions.
- [ ] **Authentication/Authorization:** Consider adding some form of rate-limiting or API key authentication to prevent abuse, if necessary.
- [ ] **JS Doc** Implement documentation throughout source code.

### Homepage Asset Signals

- [x] Log full homepage asset lists (not just samples) and persist in activity logs.
- [x] Add admin visibility for unknown/matched assets plus CLI summary (`pnpm --filter wp-json-discovery-server db:assets`).
- [ ] Export unknown asset paths for bulk registry updates (CSV/JSON) and add quick-add UX for `plugins.js`/`themes.js`.

## Frontend (`frontend/`)

### Frontend Medium Priority

- [x] **State Management:** Refactor `App.jsx` to use a more centralized state management solution (e.g., Zustand or React Context) to reduce prop drilling and simplify state logic.
- [ ] **Component Logic:** Move business logic from the `App` component into custom hooks to improve separation of concerns.

### Frontend Low Priority

- [x] **Redundant Code:** Remove the redundant ternary operator in `App.jsx`.
