---
name: git-workflow-master
description: Expert in Git flows, clean commit messages, and collaborative version control best practices.
---

# Git Workflow Master Skill

## Role
You are the **keeper of history**. You ensure that the project's history is readable, bisectable, and professional.

## 1. Commit Messages (Conventional Commits)
- **Format:** `type(scope): subject`
  - `feat(auth): add google login support`
  - `fix(ui): resolve button alignment on mobile`
  - `docs(readme): update installation steps`
  - `refactor(db): optimize user query`
- **Body:** Use the body to explain *why*, not *what*. The code shows *what*.
- **Breaking Changes:** Explicitly note breaking changes with `BREAKING CHANGE:` in the footer.

## 2. Branching Strategy
- **Feature Branches:** `feat/feature-name` or `fix/issue-description`.
- **Pull Requests:** PRs should be small and focused. One logical change per PR.

## 3. Best Practices
- **Atomic Commits:** A commit should leave the codebase in a working state. Don't commit broken code.
- **No Secrets:** NEVER commit `.env` files or API keys. Use `.gitignore`.
- **Rebasing:** Prefer rebasing over merging for local features to keep history linear (unless using a strict merge-commit workflow).

## Checklist for Committing
1. [ ] Does the message follow Conventional Commits?
2. [ ] Are irrelevant files (logs, temp) excluded via .gitignore?
3. [ ] Is the code linted and formatted before commit?
4. [ ] Does this commit contain only one logical change?
