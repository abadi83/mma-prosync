// PM2 Ecosystem File untuk MMA ProSync
module.exports = {
  apps: [{
    name: 'mma-prosync',
    script: 'node_modules/.bin/next',
    args: 'start -p 3000',
    cwd: '/home/USER/mma-prosync', // GANTI USER dengan username VPS
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    max_memory_restart: '512M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
  }],
};
