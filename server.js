const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dbConnection = require('./src/config/database');
const routes = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 3008;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests, please try again later'
  }
});
app.use(limiter);

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3010',  // Main frontend
    'http://localhost:3000',  // Development frontend
    'https://taleema.vercel.app',  // Production frontend
    'https://taleema-dev.vercel.app',  // Staging frontend
    'https://admin.taleema.se',  // Admin panel
    'https://admin-taleema.vercel.app'  // Admin panel alternate
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
});

// Health check endpoint (before routes)
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await dbConnection.healthCheck();
    const uptime = process.uptime();
    
    res.json({
      success: true,
      service: 'Education Messages System',
      status: 'operational',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
      database: dbHealth,
      version: '1.0.0'
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      service: 'Education Messages System',
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Taleema Education Messages System API',
    status: 'running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime() / 60)}m ${Math.floor(process.uptime() % 60)}s`,
    endpoints: {
      health: '/health',
      messages: '/api/messages',
      admin: '/api/messages/admin',
      conversations: '/api/messages/conversation'
    },
    documentation: 'https://docs.taleema.se/education-messages-api'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global Error Handler:', {
    error: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(isDevelopment && { 
      stack: error.stack,
      details: error 
    }),
    timestamp: new Date().toISOString()
  });
});

// Start server function
async function startServer() {
  try {
    // Start HTTP server first
    const server = app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════╗
║     Education Messages System        ║
║                                      ║
║  🚀 Server running on port ${PORT}      ║
║  🌐 Environment: ${process.env.NODE_ENV || 'development'}           ║
║  📊 Database: Connecting...          ║
║  🔐 CORS: Enabled                    ║
║  🛡️  Security: Helmet + Rate Limit   ║
║                                      ║
║  Endpoints:                          ║
║  • GET  /health                      ║
║  • GET  /api/messages/test           ║
║  • POST /api/messages/send-student-message ║
║  • GET  /api/messages/admin/all      ║
║  • POST /api/messages/admin/reply/:id ║
║  • GET  /api/messages/user/:userId   ║
║                                      ║
╚══════════════════════════════════════╝
      `);
    });

    // Try to connect to database after server starts
    try {
      await dbConnection.connect();
      console.log('✅ Database connected successfully');
    } catch (error) {
      console.error('⚠️  Database connection failed:', error.message);
      console.log('🔄 Server will continue without database connection. Mongoose will auto-reconnect.');
    }

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('\n🔄 SIGTERM received, shutting down gracefully...');
      server.close(async () => {
        await dbConnection.disconnect();
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('\n🔄 SIGINT received, shutting down gracefully...');
      server.close(async () => {
        await dbConnection.disconnect();
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;