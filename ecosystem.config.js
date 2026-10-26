// Lingua 生产进程守护配置（PM2）
// 用法：pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "lingua",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: __dirname,
      instances: 1, // 单实例（PostgreSQL 支持多实例，但单机 2GB 内存保持单实例稳妥）
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // 崩溃自动重启
      max_restarts: 10,
      min_uptime: "10s",
      // 日志
      out_file: "./logs/out.log",
      error_file: "./logs/err.log",
      merge_logs: true,
      time: true,
    },
  ],
};
