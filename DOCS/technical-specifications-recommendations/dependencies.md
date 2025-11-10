# Opuzen API Dependencies Guide

This document provides detailed information about each dependency used in the Opuzen API project.

## Production Dependencies

### Core Framework
- **express** (^4.18.2)
  - The web application framework for Node.js
  - Provides routing, middleware support, and HTTP utilities
  - Used as the foundation for building the REST API
  - [Documentation](https://expressjs.com/)

### Environment & Configuration
- **dotenv** (^16.3.1)
  - Loads environment variables from a `.env` file into `process.env`
  - Essential for managing configuration across different environments
  - Keeps sensitive information out of version control
  - [Documentation](https://www.npmjs.com/package/dotenv)

### Database
- **mysql2** (^3.6.5)
  - MySQL client for Node.js
  - Provides promise-based interface for database operations
  - Includes support for prepared statements and connection pooling
  - [Documentation](https://www.npmjs.com/package/mysql2)

### Security
- **helmet** (^7.1.0)
  - Security middleware for Express applications
  - Sets various HTTP headers to help protect the app
  - Helps prevent common web vulnerabilities
  - [Documentation](https://helmetjs.github.io/)

- **cors** (^2.8.5)
  - Cross-Origin Resource Sharing middleware
  - Enables secure cross-origin requests
  - Configurable to allow specific origins and methods
  - [Documentation](https://www.npmjs.com/package/cors)

### Validation
- **express-validator** (^7.0.1)
  - Middleware for input validation and sanitization
  - Provides validation and sanitization functions
  - Helps prevent invalid data from reaching the application
  - [Documentation](https://express-validator.github.io/)

### Logging
- **winston** (^3.11.0)
  - Versatile logging library for Node.js
  - Supports multiple transport options (console, file, etc.)
  - Provides log levels and formatting capabilities
  - [Documentation](https://github.com/winstonjs/winston)

## Development Dependencies

### Development Tools
- **nodemon** (^3.0.2)
  - Utility that monitors for changes in source code
  - Automatically restarts the server during development
  - Improves development workflow
  - [Documentation](https://nodemon.io/)

### Testing
- **jest** (^29.7.0)
  - JavaScript testing framework
  - Provides test runner, assertion library, and mocking capabilities
  - Used for unit and integration testing
  - [Documentation](https://jestjs.io/)

## Version Management

The project uses semantic versioning with the caret (^) prefix, which means:
- Major version updates are not automatically installed
- Minor and patch updates are allowed
- Example: ^4.18.2 means >=4.18.2 <5.0.0

## Best Practices

1. **Security Updates**
   - Regularly check for security updates using `npm audit`
   - Keep dependencies up to date
   - Review changelogs before updating major versions

2. **Adding New Dependencies**
   - Consider the impact on bundle size
   - Check for active maintenance
   - Review security history
   - Document the purpose in this guide

3. **Version Control**
   - Commit `package-lock.json` to ensure consistent installations
   - Use exact versions for critical dependencies
   - Document major version updates

## Common Issues and Solutions

1. **Version Conflicts**
   - Use `npm ls` to check dependency tree
   - Resolve conflicts using `npm dedupe`
   - Consider using `npm-check-updates` for managing updates

2. **Security Vulnerabilities**
   - Run `npm audit` regularly
   - Use `npm audit fix` for automatic fixes
   - Review and test manual fixes

3. **Performance Issues**
   - Monitor bundle size
   - Use appropriate logging levels
   - Implement proper connection pooling for database

## Additional Resources

- [npm Documentation](https://docs.npmjs.com/)
- [Node.js Security Best Practices](https://nodejs.org/en/security/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html) 