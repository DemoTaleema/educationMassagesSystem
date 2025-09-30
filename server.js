const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const messageRoutes = require('./src/routes/messageRoutes');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3008;

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001', 
    'http://localhost:3010',
    'https://endpoints-tunnel.vercel.app',
    'https://taleema-frontend-dev.vercel.app',
    'https://adminschoolmessagings.vercel.app'
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

// Socket.IO setup with CORS
const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make io available to routes
app.set('io', io);

// Routes
app.use('/api/messages', messageRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  // Join school room for school admins
  socket.on('join-school', (schoolId) => {
    socket.join(`school-${schoolId}`);
    console.log(`🏫 Socket ${socket.id} joined school-${schoolId}`);
  });

  // Join student room for students
  socket.on('join-student', (studentId) => {
    socket.join(`student-${studentId}`);
    console.log(`🎓 Socket ${socket.id} joined student-${studentId}`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('🔌 User disconnected:', socket.id);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    message: 'Education Messages System is running', 
    timestamp: new Date().toISOString(),
    port: PORT,
    socketConnections: io.engine.clientsCount
  });
});

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
      sendMessage: '/api/messages/send-student-message',
      getUserMessages: '/api/messages/user/:userId'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl 
  });
});

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Start server
const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`🚀 Education Messages System running on port ${PORT}`);
      console.log(`🔌 Socket.IO server ready`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`💬 Messages API: http://localhost:${PORT}/api/messages`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;