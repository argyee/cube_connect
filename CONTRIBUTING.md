# Contributing to Cube Connect

Thanks for your interest in contributing! All issues, bug reports, and pull requests are welcome.

Before you contribute:

- Check existing issues to avoid duplicates.
- If you're fixing a bug or adding a feature, please open an issue first to discuss the approach for larger changes.

Development workflow

1. Fork the repo and create a feature branch:
```bash
git checkout -b feat/my-feature
```

2. Keep changes focused and small. One feature or one bug per PR.

3. Add tests where appropriate. Server tests are run with `cd server && npm test`.

4. Run the client and server locally to verify behavior:
```bash
npm run dev:client
npm run dev:server
```

Commits & PRs

- Use clear commit messages (imperative mood): `fix: correct room join validation`.
- Open a pull request targeting `main` and include a clear description of changes and any migration or config notes.

Code style

- Follow existing patterns in the codebase.
- Keep changes minimal and well-tested.

Communication

- For significant changes, open an issue describing the problem and proposed solution before starting work.

Thanks, I appreciate your contributions!
