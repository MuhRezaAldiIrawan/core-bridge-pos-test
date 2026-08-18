export default () => ({
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 9000,
  allowedOrigins: process.env.ALLOWED_ORIGINS || 'http://localhost:9000',
});
