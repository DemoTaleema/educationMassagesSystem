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
      userId,
      studentId, 
      schoolId,
      schoolName, 
      message,
      userName,
      studentName,
      userEmail,
      studentEmail,
      studentPhone,
      programId,
      programTitle,
      messageType = 'general',
      urgencyLevel = 'normal'
    } = req.body;

    // Use userId if studentId is not provided (for backward compatibility)
    const finalStudentId = studentId || userId;
    const finalStudentName = studentName || userName;
    const finalStudentEmail = studentEmail || userEmail;

    // Validate required fields
    if (!finalStudentId || !schoolId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Student ID, School ID, and message are required',
        received: {
          studentId: finalStudentId,
          schoolId,
          message: message ? 'provided' : 'missing'
        }
      });
    }

    // Create new message
    const newMessage = new EducationMessage({
      studentId: finalStudentId,
      schoolId,
      schoolName,
      message,
      studentName: finalStudentName,
      studentEmail: finalStudentEmail,
      studentPhone,
      programId,
      programTitle,
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

// School-specific endpoints
// Get messages for a specific school
router.get('/school/:schoolId/messages', async (req, res) => {
  try {
    const { schoolId } = req.params;
    console.log('Getting messages for school:', schoolId);

    // Find all messages sent to this school
    const messages = await EducationMessage.find({ schoolId: schoolId })
      .sort({ timestamp: -1 })
      .lean();

    console.log(`Found ${messages.length} messages for school ${schoolId}`);

    // Transform the data to match frontend expectations
    const transformedMessages = messages.map(msg => ({
      id: msg._id,
      studentName: msg.studentName,
      studentEmail: msg.studentEmail,
      subject: msg.programTitle || 'General inquiry',
      text: msg.message,
      timestamp: msg.timestamp,
      status: msg.status,
      conversationId: msg._id, // Using message ID as conversation ID for now
      messageType: msg.messageType,
      urgencyLevel: msg.urgencyLevel,
      programId: msg.programId,
      programTitle: msg.programTitle,
      reply: msg.reply || ''
    }));

    res.json({
      success: true,
      messages: transformedMessages,
      count: transformedMessages.length
    });

  } catch (error) {
    console.error('Error getting school messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get school messages',
      error: error.message
    });
  }
});

// School reply to a message
router.post('/school/:schoolId/reply/:messageId', async (req, res) => {
  try {
    const { schoolId, messageId } = req.params;
    const { reply } = req.body;

    console.log('School reply:', { schoolId, messageId, reply });

    if (!reply || !reply.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reply text is required'
      });
    }

    // Find the message and update it with the reply
    const updatedMessage = await EducationMessage.findByIdAndUpdate(
      messageId,
      {
        reply: reply.trim(),
        status: 'replied',
        replyTimestamp: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!updatedMessage) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Verify the message belongs to this school
    if (updatedMessage.schoolId !== schoolId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Message does not belong to this school'
      });
    }

    console.log('Reply saved successfully for message:', messageId);

    res.json({
      success: true,
      message: 'Reply sent successfully',
      data: {
        messageId: updatedMessage._id,
        reply: updatedMessage.reply,
        status: updatedMessage.status,
        replyTimestamp: updatedMessage.replyTimestamp
      }
    });

  } catch (error) {
    console.error('Error sending school reply:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send reply',
      error: error.message
    });
  }
});

// Get conversation (for now, just return the single message with its reply)
router.get('/school/:schoolId/conversation/:conversationId', async (req, res) => {
  try {
    const { schoolId, conversationId } = req.params;
    console.log('Getting conversation:', { schoolId, conversationId });

    // For now, treat conversationId as messageId
    const message = await EducationMessage.findById(conversationId).lean();

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Verify the message belongs to this school
    if (message.schoolId !== schoolId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Conversation does not belong to this school'
      });
    }

    // Build conversation array
    const conversation = [
      {
        id: message._id,
        text: message.message,
        sender: 'student',
        senderName: message.studentName,
        timestamp: message.timestamp
      }
    ];

    // Add reply if it exists
    if (message.reply && message.reply.trim()) {
      conversation.push({
        id: `${message._id}_reply`,
        text: message.reply,
        sender: 'school',
        senderName: message.schoolName || schoolId,
        timestamp: message.replyTimestamp || message.updatedAt,
        isReply: true
      });
    }

    res.json({
      success: true,
      conversation: conversation
    });

  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get conversation',
      error: error.message
    });
  }
});

module.exports = router;