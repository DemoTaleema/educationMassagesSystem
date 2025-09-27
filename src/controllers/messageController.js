const EducationMessage = require('../models/EducationMessage');
const School = require('../models/School');

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

      // Ensure school exists in database
      let school = await School.findOne({ schoolId });
      if (!school) {
        school = new School({
          schoolId,
          schoolName,
          email: `info@${schoolName.toLowerCase().replace(/\s+/g, '')}.se`, // Default email
          programs: [programId]
        });
        await school.save();
      } else {
        // Add program to school's programs if not already present
        if (!school.programs.includes(programId)) {
          school.programs.push(programId);
          await school.save();
        }
      }

      // Create the message
      const educationMessage = new EducationMessage({
        messageId: generateRandomId(),
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

      const savedMessage = await educationMessage.save();

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

      const messages = await EducationMessage.find({ 
        userId, 
        isDeleted: false 
      })
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

      const total = await EducationMessage.countDocuments({ 
        userId, 
        isDeleted: false 
      });

      console.log(`Found ${messages.length} messages for user ${userId}`);

      res.json({
        success: true,
        data: {
          messages,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalMessages: total
          }
        }
      });

    } catch (error) {
      console.error('Error in getUserMessages:', error);
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