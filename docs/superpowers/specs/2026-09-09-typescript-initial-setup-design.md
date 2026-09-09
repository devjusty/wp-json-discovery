# Initial TypeScript Setup

## Goal

Establish TypeScript as the default foundation for new redesign code in both frontend and server workspaces without converting or changing runtime behavior of existing JavaScript.

## Scope

- Add workspace-local TypeScript configuration for `frontend/` and `server/`.
- Add root and workspace `typecheck` scripts.
- Keep existing `.js` and `.jsx` files runnable and included in the migration boundary.
- Add declaration packages needed for upcoming server TypeScript modules.
- Do not convert source files, change bundling, alter runtime validation, or redesign API contracts in this setup step.

## Configuration

Frontend configuration will target Vite and browser code:

- Include existing JavaScript plus future `.ts` and `.tsx` files.
- Use JSX support and bundler module resolution.
- Use `allowJs`, `noEmit`, and initially disabled `checkJs` and `strict` checks.
- Keep library checking skipped so existing dependency declarations do not block setup.

Server configuration will target the existing Node ESM runtime:

- Include existing JavaScript plus future `.ts` files.
- Use Node-compatible ESM module and module-resolution settings.
- Use `allowJs`, `noEmit`, and initially disabled `checkJs` and `strict` checks.
- Include Node types and keep library checking skipped during coexistence.

## Migration Rules

1. New redesign modules use `.ts` or `.tsx`.
2. Legacy modules are converted when redesign work touches them, not in a separate big-bang pass.
3. Stable contracts are typed before broad presentation migration: scan sessions, capability outcomes, API payloads, progressive states, investigations, and admin operations.
4. Strictness increases by migrated area. Each migrated area should reach `strict: true` before project-wide strictness is enabled.
5. TypeScript does not replace runtime validation. Server boundaries continue validating domains, authentication data, persisted records, and external API payloads at runtime.

## Verification

- Root `typecheck` runs both workspace checks.
- Frontend typecheck, lint, tests, and production build continue to pass.
- Server typecheck and existing Jest tests continue to pass.
- No generated JavaScript or TypeScript declaration output is committed because checks use `noEmit`.

## Non-goals

- Converting existing frontend or server files.
- Enabling project-wide strict checking immediately.
- Introducing a shared contracts package before the first cross-workspace contract requires one.
- Replacing runtime schemas or request validation with compile-time types.
