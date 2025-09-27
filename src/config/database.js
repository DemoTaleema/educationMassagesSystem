const mongoose = require('mongoose');

class DatabaseConnection {
  constructor() {
    this.connectionString = process.env.MONGODB_URI || 'mongodb+srv://EliasAB:v8ol3N9XlcWaXzsk@taleemaaicloud.gynw8lk.mongodb.net/?retryWrites=true&w=majority&appName=TaleemaAiCloud';
    this.isConnected = false;
  }

  async connect() {
    try {
      if (this.isConnected) {
        console.log('✓ Already connected to MongoDB');
        return;
      }

      // Connection options
      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 30000, // 30 seconds
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 1,
        retryWrites: true,
        connectTimeoutMS: 30000
      };

      console.log('Attempting to connect to MongoDB...');
      console.log('Connection string:', this.connectionString.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
      
      // Set mongoose options globally
      mongoose.set('bufferCommands', false);
      mongoose.set('bufferMaxEntries', 0);
      
      await mongoose.connect(this.connectionString, options);
      
      this.isConnected = true;
      console.log('✓ Connected to MongoDB - Education Messages Database');
      
      // Connection event handlers
      mongoose.connection.on('error', (error) => {
        console.error('MongoDB connection error:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.log('MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        console.log('MongoDB reconnected');
        this.isConnected = true;
      });

    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    try {
      if (!this.isConnected) {
        return;
      }

      await mongoose.connection.close();
      this.isConnected = false;
      console.log('✓ Disconnected from MongoDB');
    } catch (error) {
      console.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name
    };
  }

  // Health check for database
  async healthCheck() {
    try {
      if (!this.isConnected) {
        throw new Error('Not connected to database');
      }

      // Simple ping to check connection
      await mongoose.connection.db.admin().ping();
      
      return {
        status: 'healthy',
        connected: true,
        database: mongoose.connection.name,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Create and export singleton instance
const dbConnection = new DatabaseConnection();

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\n🔄 Gracefully shutting down...');
  await dbConnection.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔄 Gracefully shutting down...');
  await dbConnection.disconnect();
  process.exit(0);
});

module.exports = dbConnection;