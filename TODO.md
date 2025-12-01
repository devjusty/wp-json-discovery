# TODO List

This list tracks potential improvements and bug fixes for the `wp-json-discovery` application.

## Backend (`server/src/index.js`)

### Backend High Priority

- [ ] **Code Organization:** Refactor `server/src/index.js` by moving helper functions (`fetchWithRedirects`, `loadEnvFile`, `readBodyWithLimit`, `extract...` functions, etc.) into separate utility modules.
- [ ] **Error Handling:** Implement a consistent error handling and logging strategy across the backend.
- [ ] **Input Validation:** Improve input validation for all API endpoints to prevent potential security vulnerabilities.
- [ ] **HTML Parsing:** Replace regex-based HTML parsing with a more robust library like `cheerio` or `jsdom`.

### Backend Medium Priority

- [ ] **Promise Rejections:** Add more robust error handling to the `withPluginsLock` promise queue to prevent silent failures.
- [ ] **Configuration:** Move hardcoded values (e.g., timeouts, user-agent strings) to environment variables or a dedicated configuration file.

### Backend Low Priority

- [ ] **Code Duplication:** Refactor to avoid redundant calls to `sanitizeDomain`.
- [ ] **Large Functions:** Break down large functions like the `/api/sitemap-scan` handler into smaller, more manageable functions.
- [ ] **Authentication/Authorization:** Consider adding some form of rate-limiting or API key authentication to prevent abuse, if necessary.
- [ ] **JS Doc** Implement documentation throughout source code.

## Frontend (`frontend/`)

### Frontend Medium Priority

- [ ] **State Management:** Refactor `App.jsx` to use a more centralized state management solution (e.g., Zustand or React Context) to reduce prop drilling and simplify state logic.
- [ ] **Component Logic:** Move business logic from the `App` component into custom hooks to improve separation of concerns.

### Frontend Low Priority

- [ ] **Redundant Code:** Remove the redundant ternary operator in `App.jsx`.
