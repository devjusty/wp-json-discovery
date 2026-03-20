# Gemini Code-Aware Context

This document provides a comprehensive overview of the `wp-json-discovery` project to guide the Gemini AI assistant.

## Project Overview

`wp-json-discovery` is a full-stack JavaScript application designed to scan WordPress websites and analyze their publicly exposed REST API endpoints. It helps developers, security researchers, and administrators understand what data is available, which plugins are active, and identify potentially unsupported or custom API namespaces.

The project is structured as a `pnpm` monorepo containing two main packages:
-   **`frontend`**: A client application built with **React** and **Vite**. It provides the user interface for initiating scans and viewing the results.
-   **`server`**: A lightweight backend built with **Node.js** and **Express**. It acts as a proxy to circumvent CORS issues when scanning target domains, and it includes logic for persisting and managing a list of "unsupported" plugin namespaces that the tool doesn't yet recognize.

The frontend follows an **Atomic Design** pattern for its component architecture, promoting reusability and a scalable structure.

## Building and Running

The project uses `pnpm` to manage dependencies and run scripts across the workspaces.

### Key Commands

*   **Install Dependencies:**
    ```bash
    # Installs dependencies for both the frontend and server.
    pnpm install
    ```

*   **Run Development Servers:**
    ```bash
    # Starts the frontend (Vite) and backend (Express) servers in parallel.
    # Frontend is typically available at http://localhost:5173
    # Backend is available at http://localhost:4100
    pnpm dev
    ```

*   **Run Individual Services:**
    ```bash
    # Start only the frontend server
    pnpm dev:frontend

    # Start only the backend server
    pnpm dev:server
    ```

*   **Build for Production:**
    ```bash
    # Builds the React frontend for production.
    pnpm --filter frontend run build
    ```

*   **Linting:**
    ```bash
    # Runs ESLint on the frontend codebase.
    pnpm --filter frontend run lint
    ```

### Environment Configuration

Configuration is managed via `.env` files in their respective packages.
-   **`server/.env`**: Create this from `server/.env.example` to configure the backend port (default: `4100`).
-   **`frontend/.env`**: Create this from `frontend/.env.example` to change the base URL for the backend API if it's not running on the default `http://localhost:4100`.

## Development Conventions

*   **Package Manager**: This project uses `pnpm`. Always use `pnpm` instead of `npm` or `yarn` for managing dependencies.
*   **Component Architecture**: The `frontend` components are organized using the Atomic Design methodology (`atoms`, `molecules`, `organisms`, etc.).
*   **Plugin Namespaces**: Known WordPress plugin API namespaces are registered in `frontend/src/config/plugins.js`. When a scan discovers a namespace not in this file, the server persists it to Turso (configured by `TURSO_DATABASE_URL`) and seeds from the legacy `server/data/unsupported-plugins.json`.
*   **Logging**: The server records detailed scan activity, performance metrics, homepage asset findings, and errors into a JSONL file located at `server/data/activity.log`. Homepage asset paths are aggregated in Admin and via `pnpm --filter wp-json-discovery-server db:assets` to keep the registry up to date.
*   **Code Style**: The project uses ESLint to enforce a consistent coding style. Run `pnpm --filter frontend run lint` to check for issues.
