const express = require('express');
const router = express.Router();
const { EducationMessage } = require('../models/EducationMessage');
const User = require('../models/User');
const School = require('../models/School');

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Education Messages API is working',
    timestamp: new Date().toISOString()
  });
});

// Send student message to school
router.post('/send-student-message', async (req, res) => {
  try {
    const { 
      studentId, 
      schoolId, 
      message, 
      studentName,
      studentEmail,
      studentPhone,
      messageType = 'general',
      urgencyLevel = 'normal'
    } = req.body;

    // Validate required fields
    if (!studentId || !schoolId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Student ID, School ID, and message are required'
      });
    }

    // Create new message
    const newMessage = new EducationMessage({
      studentId,
      schoolId,
      message,
      studentName,
      studentEmail,
      studentPhone,
      messageType,
      urgencyLevel,
      status: 'unread',
      timestamp: new Date(),
      isFromStudent: true,
      adminNotes: '',
      reply: ''
    });

    const savedMessage = await newMessage.save();

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: savedMessage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error sending student message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
});

// Get messages for a specific user/student
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const messages = await EducationMessage.find({ 
      studentId: userId 
    }).sort({ timestamp: -1 });

    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching user messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
});

// Get all messages for admin panel
router.get('/admin/all', async (req, res) => {
  try {
    const { status, schoolId, messageType, page = 1, limit = 50 } = req.query;
    
    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (schoolId) filter.schoolId = schoolId;
    if (messageType) filter.messageType = messageType;

    const skip = (page - 1) * limit;
    
    const messages = await EducationMessage.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await EducationMessage.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: messages.length,
      totalCount,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / limit),
      data: messages,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching admin messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
});

// Admin reply to message
router.post('/admin/reply/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { reply, adminId, adminName } = req.body;

    if (!reply || !adminId) {
      return res.status(400).json({
        success: false,
        message: 'Reply and admin ID are required'
      });
    }

    const updatedMessage = await EducationMessage.findByIdAndUpdate(
      messageId,
      {
        reply,
        adminId,
        adminName,
        status: 'replied',
        replyTimestamp: new Date()
      },
      { new: true }
    );

    if (!updatedMessage) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Reply sent successfully',
      data: updatedMessage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error sending admin reply:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send reply',
      error: error.message
    });
  }
});

// Mark message as read
router.patch('/admin/mark-read/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { adminId, adminName } = req.body;

    const updatedMessage = await EducationMessage.findByIdAndUpdate(
      messageId,
      {
        status: 'read',
        readBy: adminId,
        readByName: adminName,
        readTimestamp: new Date()
      },
      { new: true }
    );

    if (!updatedMessage) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Message marked as read',
      data: updatedMessage,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark message as read',
      error: error.message
    });
  }
});

module.exports = router;