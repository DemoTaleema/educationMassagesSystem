const express = require('express');
const messageRoutes = require('./messageRoutes');
const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Education Messages System is running',
    timestamp: new Date().toISOString(),
    service: 'educationMessagesSystem'
  });
});

// Message routes
router.use('/messages', messageRoutes);

module.exports = router;