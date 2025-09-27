const express = require('express');
const messageController = require('../controllers/messageController');
const router = express.Router();

// Student message routes
router.post('/send-student-message', messageController.sendStudentMessage);
router.get('/user/:userId', messageController.getUserMessages);

// Admin routes
router.get('/admin/all', messageController.getAdminMessages);
router.post('/admin/reply/:messageId', messageController.replyToMessage);
router.put('/admin/status/:messageId', messageController.updateMessageStatus);

// Conversation routes
router.get('/conversation/:conversationId', messageController.getConversation);

module.exports = router;