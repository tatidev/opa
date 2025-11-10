# Opuzen API Development Guide

This guide provides detailed instructions for setting up and running the Opuzen API in a development environment.

## Quick Start

### Prerequisites
- Node.js 18 or higher
- Docker and Docker Compose
- MySQL 8.0 database (local or remote)
- Git

### Initial Setup

1. Clone the repository:
   ```bash
   git clone [repository-url]
   cd opuzen-api
   ```

2. Create and configure your `.env` file:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` with your local configuration.

3. Install dependencies:
   ```bash
   npm install
   ```

## Development Workflow

### Option 1: Docker Development (Recommended)

The Docker setup provides a consistent development environment with hot reloading:

```bash
docker-compose up
```

This will:
- Start the API server on http://localhost:3000
- Enable hot reloading (changes are reflected immediately)
- Mount your local code into the container
- Connect to your local MySQL database
- Show real-time logs

### Option 2: Local Development

If you prefer running directly on your machine:

```bash
npm run dev
```

This uses nodemon to:
- Watch for file changes
- Automatically restart the server
- Show real-time logs

## Verifying Your Setup

1. Start the server using either method above
2. Test the health endpoint:
   ```bash
   curl http://localhost:3000/health
   ```
3. Make a change to any file in the `src` directory
4. The server should automatically restart
5. Check the logs to confirm the changes were picked up

## Development Tips

### Hot Reloading
- File changes in the `src` directory trigger automatic server restarts
- Changes to `package.json` require manual restart
- Environment variable changes require restart

### Debugging
- Logs are output in JSON format with timestamps
- Use `LOG_LEVEL=debug` in `.env` for detailed logging
- Check Docker logs with `docker-compose logs -f`

### Database Connection
- In development, the API connects to your local MySQL using `host.docker.internal`
- Ensure your MySQL server is running and accessible
- Default port is 3306

### Common Issues

1. **Port Conflicts**
   - If port 3000 is in use, change `PORT` in `.env`
   - Update `docker-compose.yml` if using Docker

2. **Database Connection**
   - Verify MySQL is running
   - Check database credentials in `.env`
   - Ensure MySQL is accessible from Docker

3. **Hot Reload Not Working**
   - Check file permissions
   - Verify you're editing files in the correct directory
   - Restart the development server

## Best Practices

1. **Code Changes**
   - Make changes in the `src` directory
   - Follow the project's coding standards
   - Test changes locally before committing

2. **Environment Variables**
   - Never commit `.env` file
   - Keep `.env.example` updated
   - Document new environment variables

3. **Docker Usage**
   - Use `docker-compose up` for development
   - Use `docker-compose down` to stop services
   - Use `docker-compose build` after dependency changes

## Additional Resources

- [Node.js Documentation](https://nodejs.org/docs)
- [Docker Documentation](https://docs.docker.com)
- [Express.js Documentation](https://expressjs.com)
- [MySQL Documentation](https://dev.mysql.com/doc) 