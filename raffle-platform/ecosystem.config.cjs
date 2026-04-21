// PM2 process config for the raffle platform.
// Usage:
//   pm2 start ecosystem.config.cjs
//   pm2 save
//   pm2 startup  (run the printed command to auto-start on reboot)

module.exports = {
  apps: [
    {
      name: 'spectrum-raffle',
      script: 'node_modules/.bin/next',
      args: 'start --port 3001',
      cwd: '/opt/spectrum-raffle/raffle-platform',
      interpreter: 'none',
      env_production: {
        NODE_ENV: 'production',
        PORT: '3001',
      },
      // Restart if the process crashes
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      // Keep logs tidy
      out_file: '/var/log/spectrum-raffle/out.log',
      error_file: '/var/log/spectrum-raffle/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
