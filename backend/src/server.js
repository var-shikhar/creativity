const http = require('http');
const socketIO = require('socket.io');
const cron = require('node-cron');
const app = require('./app');
const { connectRedis } = require('./config/redis');
const monitorService = require('./services/monitorService');

const PORT = process.env.PORT || 5000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = socketIO(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
  }
});

// Make io available globally
global.io = io;

// WebSocket authentication and room management
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join organization room
  socket.on('join:organization', (orgId) => {
    socket.join(`org-${orgId}`);
    console.log(`Socket ${socket.id} joined org-${orgId}`);

    socket.emit('joined', {
      room: `org-${orgId}`,
      message: 'Successfully joined organization room'
    });
  });

  // Leave organization room
  socket.on('leave:organization', (orgId) => {
    socket.leave(`org-${orgId}`);
    console.log(`Socket ${socket.id} left org-${orgId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  // Ping/pong for connection health
  socket.on('ping', () => {
    socket.emit('pong');
  });
});

// Initialize services
const initializeServices = async () => {
  try {
    console.log('🚀 PulseAPI Server Starting...\n');

    // Connect to Redis
    console.log('📡 Connecting to Redis...');
    await connectRedis();

    // Initialize all monitors
    console.log('\n📊 Initializing monitoring engine...');
    await monitorService.initializeAllMonitors();

    // Schedule daily statistics calculation (runs at 1 AM)
    cron.schedule('0 1 * * *', async () => {
      console.log('📊 Running daily statistics calculation...');
      await monitorService.calculateDailyStats();
    });

    console.log('\n✅ All services initialized successfully\n');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    process.exit(1);
  }
};

// Start server
const startServer = async () => {
  await initializeServices();

  server.listen(PORT, () => {
    console.log(`┌─────────────────────────────────────────────┐`);
    console.log(`│                                             │`);
    console.log(`│         🚀 PulseAPI Server Ready           │`);
    console.log(`│                                             │`);
    console.log(`│  HTTP:      http://localhost:${PORT}        │`);
    console.log(`│  WebSocket: ws://localhost:${PORT}          │`);
    console.log(`│  Env:       ${process.env.NODE_ENV || 'development'}                       │`);
    console.log(`│                                             │`);
    console.log(`└─────────────────────────────────────────────┘\n`);
  });
};

// Graceful shutdown
const shutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...');

  server.close(() => {
    console.log('✓ HTTP server closed');
  });

  io.close(() => {
    console.log('✓ WebSocket server closed');
  });

  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown();
});

// Start the server
startServer();
