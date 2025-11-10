/**
 * PM2 Ecosystem Configuration
 * 
 * This file configures how PM2 manages the OPMS API application.
 * It ensures single-process operation and proper environment configuration.
 * 
 * Usage:
 *   pm2 start ecosystem.config.js     # Start the app
 *   pm2 reload opms-api               # Zero-downtime restart
 *   pm2 stop opms-api                 # Stop the app
 *   pm2 restart opms-api              # Restart with brief downtime
 *   pm2 logs opms-api                 # View logs
 *   pm2 monit                         # Monitor CPU/memory
 */

module.exports = {
  apps: [{
    name: 'opms-api',
    script: './src/index.js',
    
    // Process Configuration
    instances: 1,              // CRITICAL: Single instance only (prevents duplicates)
    exec_mode: 'fork',         // Fork mode (not cluster)
    
    // Environment Variables
    env: {
      NODE_ENV: 'prod'
    },
    
    // Logging
    error_file: '/home/ubuntu/logs/opms-api-error.log',
    out_file: '/home/ubuntu/logs/opms-api-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Restart Behavior
    autorestart: true,         // Auto-restart if crashed
    max_restarts: 10,          // Max restarts in min_uptime window
    min_uptime: 10000,         // Must stay up 10s to avoid crash loop
    restart_delay: 4000,       // Wait 4s before restart attempt
    
    // Health Monitoring
    listen_timeout: 30000,     // Wait 30s for app to listen on port
    kill_timeout: 5000,        // Wait 5s for graceful shutdown
    
    // Additional Options
    watch: false,              // Don't watch file changes (we use git watcher)
    ignore_watch: ['node_modules', 'logs'],
    max_memory_restart: '500M' // Restart if memory exceeds 500MB
  }]
};

