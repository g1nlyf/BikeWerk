# BikeWerk Development Rules

You are working on the **BikeWerk** project, a premium used bicycle marketplace and CRM.
Your goal is to maintain High Availability, Code Quality, and Developer Happiness.

## 1. Project Context & Architecture
- **Frontend**: React, Vite, TailwindCSS (Radix UI / Shadcn philosophy).
- **Backend**: NodeJS (Express), PostgreSQL.
- **Tools**: Playwright (E2E), Jest (Unit), Git.

## 2. General AI Behavior (The "Genius" Mode)
- **Be Proactive**: Don't just fix the error; fix the *root cause*. Suggest architectural improvements if you see tech debt.
- **No Hallucinations**: If you don't know a library version or file path, *check* first. Don't guess.
- **Context is King**: Before editing a file, read its imports and related types. Maintain consistency with existing patterns.
- **Conciseness**: Give me the code or the answer. I don't need a lecture unless I asked "Why?".

## 3. Frontend Rules (React + Tailwind)
- **Styling**:
  - Use **TailwindCSS** for everything. Avoid `.css` files unless for global resets or complex animations.
  - Use `clsx` or `cn` (classnames utility) for conditional classes.
  - **Dark Mode**: Always ensure changes look good in both Light and Dark modes.
- **Components**:
  - **Functional Components** only. No Class components.
  - **Hooks**: Use custom hooks for complex logic (`useBikeFilters`, `useAuth`).
  - **Props**: Defined via TypeScript Interfaces, not `propTypes`.
- **State Management**:
  - Prefer server state (TanStack Query / SWR) over global client state for data.
  - Use Context API sparingly (Theme, Auth, Toast).

## 4. Backend Rules (Node + Postgres)
- **Database**:
  - **No Raw SQL strings** where possible. Use the ORM/Query Builder pattern established in the project.
  - **Migrations**: Database schema changes MUST have a migration script.
- **API**:
  - RESTful principles.
  - Return standard error objects `{ error: "message", code: "ErrorCode" }`.
  - Validate ALL inputs (Zod/Joi).

## 5. Coding Standards (The "No-Nonsense" List)
- **TypeScript**: Strict mode. No `any` unless absolutely necessary (and commented why).
- **Naming**:
  - Components: `PascalCase` (`BikeCard.tsx`)
  - Functions/Vars: `camelCase` (`getBikeData`)
  - Constants: `UPPER_SNAKE_CASE` (`MAX_RETRIES`)
- **Comments**: Explain *WHY*, not *WHAT*.
  - *Bad*: `// increment i`
  - *Good*: `// retry connection 3 times before failing`

## 6. Git & Workflow
- **Commits**: Conventional Commits format (`feat:`, `fix:`, `refactor:`, `chore:`).
- **Safety**: NEVER commit secrets (`.env`, private keys).
- **Review**: Before marking a task done, self-review: "Would I merge this PR?".

## 7. Troubleshooting
- **Logs**: If something breaks, check `logs/` directory first.
- **Restart**: If env vars change, remind user to restart.

---
**Focus on delivering Value. Write code that survives.**
