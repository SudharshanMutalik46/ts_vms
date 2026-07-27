# Contributing

Thanks for helping improve Techno VMS.

## Development workflow

1. Create a focused branch from `main`.
2. Keep credentials, camera URLs, recordings, model files, and generated outputs out of commits.
3. Make the smallest change that solves the issue.
4. Validate the affected component.
5. Open a pull request that explains the change and how it was tested.

## Frontend validation

```bash
cd frontend
npm ci
npm run build
```

The same build runs in GitHub Actions for frontend pull requests.

## Native services

Native changes should compile with CMake 3.16+ and a C++17 toolchain. Document the operating system, dependency versions, build command, and verification result in the pull request.

## Commit messages

Use short, action-oriented messages, for example:

- `Fix TypeScript source ignore rules`
- `Add frontend build validation`
- `Document recording engine setup`

