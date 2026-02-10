# General Rules for BikeWerk Project

## Terminal Environment

All terminal commands MUST be executed using **PowerShell** (not CMD or bash).

### PowerShell Specific Guidelines:
- Use PowerShell-compatible syntax for all commands
- Use `$env:VARIABLE` instead of `%VARIABLE%` for environment variables
- Use `;` for command chaining (not `&&`)
- Use `Set-Location` or `cd` for directory navigation
- Use `Remove-Item -Recurse -Force` instead of `rmdir /s /q`
- Use `New-Item -ItemType Directory` instead of `mkdir`
- Use `Get-Content` instead of `cat` or `type`
- Use `Copy-Item` instead of `copy`

### Command Execution:
- Always specify full paths when possible
- Working directory should be set via the Cwd parameter
- Long-running commands should use appropriate WaitMsBeforeAsync values

## Code Quality Standards

### General:
- All code must be properly formatted and linted
- No hardcoded values - use constants and environment variables
- All functions must have error handling (try-catch)
- Comments for non-obvious logic

### Backend (Node.js/Express):
- All endpoints must have authentication (`authenticateToken`)
- CRM endpoints must require manager role (`requireManagerRole`)
- All mutations must be logged to audit_log
- Timeline events for user-visible changes
- Input validation on all endpoints

### Frontend (React/TypeScript):
- Use existing UI components from the project
- Follow BikeWerk design system (black/white theme, soft shadows, rounded corners)
- All interactive elements must have hover states
- All actions must provide user feedback (toast, loader)
- Responsive design considerations

### Database:
- Use transactions for multi-table operations
- Create migrations for schema changes
- Add indexes for frequently queried fields
