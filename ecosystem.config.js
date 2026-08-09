// PM2 Ecosystem File untuk MMA ProSync
module.exports = {
  apps: [{
    name: 'mma-prosync',
    script: './.next/standalone/server.js',
    args: '',
    cwd: '/home/mulus/mma-prosync', // GANTI sesuai username/path VPS Mulus
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
