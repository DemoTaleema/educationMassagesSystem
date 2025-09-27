const EducationMessage = require('../models/EducationMessage');
const School = require('../models/School');
const mongoose = require('mongoose');

// Generate random string ID
const generateRandomId = (length = 16) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

class MessageController {
  // Send a new message from student about a program
  async sendStudentMessage(req, res) {
    try {
      // Check if mongoose is connected
      if (mongoose.connection.readyState !== 1) {
        console.log('Database not connected, current state:', mongoose.connection.readyState);
        return res.status(503).json({
          success: false,
          message: 'Database service temporarily unavailable'
        });
      }

      const {
        userId,
        userEmail,
        userName,
        programId,
        programTitle,
        schoolId,
        schoolName,
        message
      } = req.body;

      console.log('Received message data:', { userId, userEmail, userName, programId, programTitle, schoolId, schoolName, message });

      // Validate required fields
      if (!userId || !userEmail || !userName || !programId || !programTitle || 
          !schoolId || !schoolName || !message) {
        console.log('Missing required fields validation failed');
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
          received: { userId, userEmail, userName, programId, programTitle, schoolId, schoolName, message }
        });
      }

      // Create the message directly without school lookup to avoid timeout
      // Generate conversationId based on user, school, and program for consistency
      const conversationId = `${userId}_${schoolId}_${programId}`;
      
      const educationMessage = new EducationMessage({
        messageId: generateRandomId(),
        conversationId,
        userId,
        userEmail,
        userName,
        programId,
        programTitle,
        schoolId,
        schoolName,
        message,
        sender: 'student',
        messageType: 'inquiry',
        status: 'sent'
      });

      console.log('Attempting to save message...');
      
      // Add timeout to the save operation
      const savedMessage = await Promise.race([
        educationMessage.save(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Save operation timeout')), 8000)
        )
      ]);
      
      console.log('Message saved successfully:', savedMessage.messageId);

      // Create or update school in background (fire and forget)
      setImmediate(async () => {
        try {
          const existingSchool = await School.findOne({ schoolId }).maxTimeMS(5000);
          if (!existingSchool) {
            const school = new School({
              schoolId,
              schoolName,
              email: `info@${schoolName.toLowerCase().replace(/\s+/g, '')}.se`,
              programs: [programId]
            });
            await school.save();
            console.log('School created in background:', schoolId);
          } else if (!existingSchool.programs.includes(programId)) {
            existingSchool.programs.push(programId);
            await existingSchool.save();
            console.log('Program added to existing school:', programId);
          }
        } catch (error) {
          console.log('Background school operation failed (non-critical):', error.message);
        }
      });

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: {
          messageId: savedMessage.messageId,
          conversationId: savedMessage.conversationId,
          sentAt: savedMessage.sentAt
        }
      });

    } catch (error) {
      console.error('Error in sendStudentMessage:', error);
      
      // Check if it's a timeout or connection error
      if (error.message.includes('timeout') || error.message.includes('buffering')) {
        return res.status(503).json({
          success: false,
          message: 'Database operation timed out',
          error: 'Service temporarily unavailable'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to send message',
        error: error.message
      });
    }
  }

  // Get all messages for admin panel
  async getAdminMessages(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        status = '', 
        schoolId = '', 
        search = '',
        sortBy = 'sentAt',
        sortOrder = 'desc'
      } = req.query;

      // Build query
      const query = { isDeleted: false };
      
      if (status && ['sent', 'delivered', 'read', 'replied'].includes(status)) {
        query.status = status;
      }
      
      if (schoolId) {
        query.schoolId = schoolId;
      }
      
      if (search) {
        query.$or = [
          { message: { $regex: search, $options: 'i' } },
          { userName: { $regex: search, $options: 'i' } },
          { schoolName: { $regex: search, $options: 'i' } },
          { programTitle: { $regex: search, $options: 'i' } }
        ];
      }

      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sortDirection = sortOrder === 'desc' ? -1 : 1;

      // Get messages with pagination
      const messages = await EducationMessage.find(query)
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(parseInt(limit));

      // Get total count
      const total = await EducationMessage.countDocuments(query);

      // Get statistics
      const stats = await this.getMessageStats();

      res.json({
        success: true,
        data: {
          messages,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalMessages: total,
            hasNext: skip + messages.length < total,
            hasPrev: parseInt(page) > 1
          },
          stats
        }
      });

    } catch (error) {
      console.error('Error in getAdminMessages:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch messages',
        error: error.message
      });
    }
  }

  // Reply to a message (admin or school)
  async replyToMessage(req, res) {
    try {
      const { messageId } = req.params;
      const { 
        message, 
        sender = 'admin', 
        adminId = null,
        adminName = 'Support Team' 
      } = req.body;

      if (!message || !['admin', 'school'].includes(sender)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reply data'
        });
      }

      // Find original message
      const originalMessage = await EducationMessage.findOne({ 
        messageId, 
        isDeleted: false 
      });

      if (!originalMessage) {
        return res.status(404).json({
          success: false,
          message: 'Original message not found'
        });
      }

      // Create reply message
      const replyMessage = new EducationMessage({
        messageId: generateRandomId(),
        conversationId: originalMessage.conversationId,
        userId: originalMessage.userId,
        userEmail: originalMessage.userEmail,
        userName: originalMessage.userName,
        programId: originalMessage.programId,
        programTitle: originalMessage.programTitle,
        schoolId: originalMessage.schoolId,
        schoolName: originalMessage.schoolName,
        message,
        sender,
        messageType: 'reply',
        status: 'sent',
        parentMessageId: originalMessage.messageId,
        isReply: true,
        assignedAdminId: adminId
      });

      await replyMessage.save();

      // Update original message
      await EducationMessage.updateOne(
        { messageId },
        { 
          $set: { 
            status: 'replied',
            repliedAt: new Date(),
            hasReplies: true
          },
          $inc: { replyCount: 1 }
        }
      );

      res.status(201).json({
        success: true,
        message: 'Reply sent successfully',
        data: {
          replyId: replyMessage.messageId,
          conversationId: replyMessage.conversationId
        }
      });

    } catch (error) {
      console.error('Error in replyToMessage:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send reply',
        error: error.message
      });
    }
  }

  // Get conversation thread
  async getConversation(req, res) {
    try {
      const { conversationId } = req.params;

      const messages = await EducationMessage.getConversation(conversationId);
      
      if (!messages.length) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found'
        });
      }

      res.json({
        success: true,
        data: {
          conversationId,
          messages,
          messageCount: messages.length
        }
      });

    } catch (error) {
      console.error('Error in getConversation:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch conversation',
        error: error.message
      });
    }
  }

  // Get messages for a specific user (for dashboard chat)
  async getUserMessages(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      console.log(`Fetching messages for userId: ${userId}`);

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Add timeout to prevent buffering issues
      const messages = await EducationMessage.find({ 
        userId, 
        isDeleted: false 
      })
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .maxTimeMS(10000); // 10 second timeout

      const total = await EducationMessage.countDocuments({ 
        userId, 
        isDeleted: false 
      }).maxTimeMS(5000); // 5 second timeout for count

      console.log(`Found ${messages.length} messages for user ${userId}`);

      res.json({
        success: true,
        data: {
          messages: messages || [],
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil((total || 0) / parseInt(limit)),
            totalMessages: total || 0
          }
        }
      });

    } catch (error) {
      console.error('Error in getUserMessages:', error);
      
      // If it's a timeout error, return empty array instead of failing
      if (error.message.includes('buffering timed out') || error.message.includes('timeout')) {
        console.log('Database timeout, returning empty messages array');
        return res.json({
          success: true,
          data: {
            messages: [],
            pagination: {
              currentPage: parseInt(req.query.page || 1),
              totalPages: 0,
              totalMessages: 0
            }
          },
          warning: 'Database timeout - please try again'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user messages',
        error: error.message
      });
    }
  }

  // Helper method for message statistics
  async getMessageStats() {
    try {
      const stats = await EducationMessage.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]);

      const schoolStats = await EducationMessage.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: '$schoolId',
            schoolName: { $first: '$schoolName' },
            messageCount: { $sum: 1 }
          }
        },
        { $sort: { messageCount: -1 } },
        { $limit: 10 }
      ]);

      return {
        statusBreakdown: stats,
        topSchools: schoolStats,
        totalMessages: await EducationMessage.countDocuments({ isDeleted: false })
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return { error: 'Failed to get statistics' };
    }
  }

  // Update message status (mark as read, etc.)
  async updateMessageStatus(req, res) {
    try {
      const { messageId } = req.params;
      const { status } = req.body;

      if (!['sent', 'delivered', 'read', 'replied'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status'
        });
      }

      const updatedMessage = await EducationMessage.findOneAndUpdate(
        { messageId, isDeleted: false },
        { 
          status, 
          ...(status === 'read' && { readAt: new Date() })
        },
        { new: true }
      );

      if (!updatedMessage) {
        return res.status(404).json({
          success: false,
          message: 'Message not found'
        });
      }

      res.json({
        success: true,
        message: 'Message status updated',
        data: updatedMessage
      });

    } catch (error) {
      console.error('Error in updateMessageStatus:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update message status',
        error: error.message
      });
    }
  }
}

module.exports = new MessageController();