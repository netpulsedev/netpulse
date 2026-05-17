# Contributing to NetPulse

First off, thanks for taking the time to contribute! 🎉

The following is a set of guidelines for contributing to NetPulse. These are mostly guidelines, not rules — use your best judgment, and feel free to propose changes to this document in a pull request.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Style Guide](#style-guide)

## Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### 🐛 Reporting Bugs

Before creating a bug report, please check existing issues to see if the problem has already been reported.

When creating a bug report, include:
- A clear, descriptive title
- Steps to reproduce the behavior
- Expected behavior vs. actual behavior
- Your browser, OS, and connection type
- Screenshots or exported diagnostic reports (TXT/JSON) if applicable

### 💡 Suggesting Features

Feature requests are welcome! Please open an issue with:
- A clear description of the feature
- Why it would be useful
- Any implementation ideas you have

### 🔧 Code Contributions

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run the build to ensure no TypeScript errors (`cd client && npm run build`)
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+
- A Cloudflare account (for Worker deployment, optional for local dev)

### Local Development

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/netpulse.git
cd netpulse

# Terminal 1 — Start the Worker
cd worker
npm install
npm run dev
# Worker runs on http://localhost:8787

# Terminal 2 — Start the Frontend
cd client
npm install
npm run dev
# App runs on http://localhost:5173
# /api/* requests are proxied to the Worker
```

### Building

```bash
cd client
npm run build   # Runs tsc + vite build
```

The build must pass with **zero TypeScript errors** before submitting a PR.

## Pull Request Process

1. Ensure the build passes (`npm run build` in `/client`)
2. Update the README if your change affects the public API or features
3. Use [Conventional Commits](https://www.conventionalcommits.org/) for your commit messages:
   - `feat:` — New feature
   - `fix:` — Bug fix
   - `perf:` — Performance improvement
   - `docs:` — Documentation only
   - `refactor:` — Code change that neither fixes a bug nor adds a feature
   - `chore:` — Maintenance tasks
4. Your PR will be reviewed and merged once approved

## Style Guide

### TypeScript

- Strict mode enabled — no `any` unless absolutely necessary
- Use functional components with hooks
- Prefer `const` over `let`
- No unused variables or imports (the build will fail)

### CSS

- Use CSS custom properties (defined in `index.css`) for colors and spacing
- Use the `card` and `btn-primary`/`btn-secondary` classes from the design system
- Mobile-first responsive design

### File Organization

- Services go in `src/services/`
- State management in `src/store/` (Zustand)
- Reusable hooks in `src/hooks/`
- Utility functions in `src/utils/`
- UI components in `src/components/`

## Questions?

Feel free to open an issue with the `question` label. We're happy to help!
