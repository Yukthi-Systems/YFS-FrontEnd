# YFS-WebUi

Secure, local-first web storage file explorer user interface.

## Tech Stack

- **Framework & Tooling**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vite.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **State Management**: [Jotai](https://jotai.org/) (for atomic global state)
- **Data Fetching**: [TanStack Query v5](https://tanstack.com/query) (React Query)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Code Formatting**: [Prettier](https://prettier.io/)

## Architecture and Directory Rules

To maintain high code quality and consistency across Y-Files apps, we follow these directory rules strictly:

### 1. Library Helpers (`src/lib/`)

- All helper scripts, utilities, and general shared functions must reside inside the `src/lib/` folder.
- E.g., class-name merges in `src/lib/utils.ts`.

### 2. Services (`src/services/`)

- Do not put state query logic inside the pages folder.
- Structure api functions inside `src/services/<category>/` subdirectories.
  - `api.ts`: Raw network and database request definitions (e.g. simulated mock databases).
  - `mutations.ts`: React Query hooks (queries and mutations) calling the raw API definitions.

### 3. Page Structures (`src/pages/`)

- Major views have an `index.tsx` entry file.
- **No `components` directories**: Page-specific subcomponents must reside directly as siblings inside the root page folder.
- E.g., `src/pages/FileList/index.tsx`, `src/pages/FileList/FileGrid.tsx`, `src/pages/FileList/Sidebar.tsx`.

### 4. Global State (`src/store/`)

- Shared UI and view variables (theme toggles, modal indicators, selected items) are managed using **Jotai** atoms in `src/store/`.

### 5. Type Definitions (`src/types/`)

- All shared TypeScript interfaces, types, and domain object definitions must reside in the `src/types/` folder.

### 6. Primitive UI Components (`src/components/ui/`)

- Reusable base UI elements and Shadcn components (e.g., Buttons, Dialogs, Inputs) must go inside the `src/components/ui/` folder.

---

## Getting Started

### Development Server

```bash
npm run dev
```

### Code Formatting (Prettier)

```bash
npm run format
```

### Production Build

```bash
npm run build
```
