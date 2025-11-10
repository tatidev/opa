# Git Hooks Guide

## Overview

Git hooks are automated scripts that run at specific points in your Git workflow. This project uses git hooks to enforce code quality by running tests automatically before commits and pushes.

## Current Setup

### Pre-commit Hook
**Purpose**: Fast feedback on unit tests before each commit
**Execution Time**: ~1-3 seconds
**Tests Run**: Unit tests only (colors, items, products, display-name)
**Tests Skipped**: Integration tests (netsuite*, auth, users, vendors)

### Pre-push Hook  
**Purpose**: Comprehensive testing before pushing to remote repository
**Execution Time**: ~30-60 seconds
**Tests Run**: All tests including integration tests
**Coverage**: Generates test coverage reports

## How It Works

### Normal Workflow
```bash
# 1. Make your changes
git add .

# 2. Commit (pre-commit hook runs automatically)
git commit -m "your commit message"
# 🔍 Running pre-commit checks...
# 🧪 Running Jest test suite...
# ✅ All tests passed! Proceeding with commit...

# 3. Push (pre-push hook runs automatically)  
git push origin your-branch
# 🚀 Running pre-push checks for remote: origin
# 🧪 Running comprehensive Jest test suite...
# 📊 Checking test coverage requirements...
# 🎉 All tests passed! Proceeding with push...
```

### When Tests Fail
```bash
git commit -m "broken code"
# 🔍 Running pre-commit checks...
# 🧪 Running Jest test suite...
# ❌ Tests failed! Commit aborted.
# 💡 Fix failing tests and try again.
# 💡 Run 'npm test' to see detailed test results.
```

## Emergency Bypass

**⚠️ Use sparingly and only in emergencies!**

```bash
# Bypass pre-commit hook
git commit --no-verify -m "emergency fix"

# Bypass pre-push hook
git push --no-verify origin your-branch
```

**When to use bypass:**
- Critical production hotfixes
- Fixing broken CI/CD pipeline
- Working on test infrastructure itself

**⚠️ Always fix tests immediately after using bypass!**

## Installation

### Automatic Setup
```bash
# Run the setup script
node scripts/setup-git-hooks.js
```

### Manual Setup
```bash
# Make hooks executable
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/pre-push

# Test hooks are working
git commit -m "test commit"
```

### Team Setup
When new developers join:
1. Clone the repository
2. Run `node scripts/setup-git-hooks.js`
3. Hooks are automatically installed and ready

## Troubleshooting

### Hook Not Running
```bash
# Check if hooks are executable
ls -la .git/hooks/

# Should show:
# -rwxr-xr-x  1 user  staff  1234 date pre-commit
# -rwxr-xr-x  1 user  staff  5678 date pre-push

# If not executable, run:
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/pre-push
```

### Tests Taking Too Long
```bash
# Pre-commit should be fast (~1-3 seconds)
# If slow, check if integration tests are being included

# Pre-push can be slower (~30-60 seconds)
# This is normal for comprehensive testing
```

### Missing Dependencies
```bash
# Hooks automatically install dependencies
# If issues persist, manually install:
npm install
```

### Environment Issues
```bash
# Hooks run in git environment, not your shell
# Environment variables from .env files may not be available
# Integration tests may fail - this is expected for pre-commit
```

## Customization

### Modify Test Selection
Edit `.git/hooks/pre-commit` to change which tests run:
```bash
# Current: Skip integration tests
npm test -- --testPathIgnorePatterns="netsuite.test.js|netsuiteItemService.test.js|auth.test.js|users.test.js|vendors.test.js"

# Run all tests (slower):
npm test

# Run specific pattern:
npm test -- --testNamePattern="unit"
```

### Adjust Timeouts
Edit `.git/hooks/pre-push` for longer timeouts:
```bash
# Add timeout for slow tests
npm test -- --testTimeout=30000
```

## Best Practices

### Developer Workflow
1. **Write tests first** - Ensure your changes have corresponding tests
2. **Run tests locally** - Use `npm test` before committing
3. **Fix failing tests** - Don't rely on bypass options
4. **Keep commits small** - Smaller changes = faster test execution

### Test Organization
- **Unit tests**: Fast, isolated, no external dependencies
- **Integration tests**: Slower, test component interactions
- **Pre-commit**: Unit tests only for speed
- **Pre-push**: All tests for completeness

### Performance Tips
- Keep unit tests under 100ms each
- Mock external services in unit tests
- Use test databases for integration tests
- Parallel test execution where possible

## Configuration Files

### Test Configuration
- `package.json`: Jest configuration and scripts
- `src/__tests__/setup.js`: Test environment setup
- `.git/hooks/pre-commit`: Pre-commit test configuration
- `.git/hooks/pre-push`: Pre-push test configuration

### Related Documentation
- [Test Standards and Conventions](../ai-specs/development/test-standards-and-conventions.md)
- [Testing Standards Rules](../../.cursor/rules/04-testing-standards.mdc)

## Monitoring and Maintenance

### Regular Reviews
- **Weekly**: Review hook performance and test execution times
- **Monthly**: Update test patterns and hook configuration
- **Quarterly**: Review bypass usage and fix underlying issues

### Team Metrics
- Track bypass usage frequency
- Monitor test execution times
- Identify frequently failing tests
- Measure developer productivity impact

---

**Status**: Active and enforced for all commits and pushes
**Last Updated**: 2025-01-11
**Maintained By**: Development Team