const mongoose = require('mongoose');

// Comprehensive messaging schema for education communication
const educationMessageSchema = new mongoose.Schema({
  // Message identification
  messageId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  conversationId: {
    type: String,
    required: true,
    index: true // Groups related messages together
  },
  
  // User information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  userEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  userName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Program/School information
  programId: {
    type: String,
    required: true,
    index: true
  },
  programTitle: {
    type: String,
    required: true,
    trim: true
  },
  schoolId: {
    type: String,
    required: true,
    index: true
  },
  schoolName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Message content
  message: {
    type: String,
    required: true,
    maxlength: 5000,
    trim: true
  },
  messageType: {
    type: String,
    enum: ['inquiry', 'reply', 'follow_up'],
    default: 'inquiry'
  },
  
  // Message metadata
  sender: {
    type: String,
    enum: ['student', 'admin', 'school'],
    required: true
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'replied'],
    default: 'sent'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  // Threading and replies
  parentMessageId: {
    type: String,
    index: true,
    default: null // null for original messages
  },
  isReply: {
    type: Boolean,
    default: false
  },
  hasReplies: {
    type: Boolean,
    default: false
  },
  replyCount: {
    type: Number,
    default: 0
  },
  
  // Admin handling
  assignedAdminId: {
    type: String,
    default: null
  },
  adminNotes: {
    type: String,
    maxlength: 1000
  },
  
  // Timestamps
  sentAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  readAt: Date,
  repliedAt: Date,
  
  // Additional metadata
  attachments: [{
    fileName: String,
    fileUrl: String,
    fileType: String,
    fileSize: Number
  }],
  tags: [String],
  isArchived: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
educationMessageSchema.index({ userId: 1, sentAt: -1 });
educationMessageSchema.index({ schoolId: 1, sentAt: -1 });
educationMessageSchema.index({ conversationId: 1, sentAt: 1 });
educationMessageSchema.index({ status: 1, sentAt: -1 });
educationMessageSchema.index({ sender: 1, status: 1 });
educationMessageSchema.index({ programId: 1, sentAt: -1 });

// Virtual for formatted send time
educationMessageSchema.virtual('formattedSentAt').get(function() {
  return this.sentAt.toLocaleString();
});

// Static methods for common queries
educationMessageSchema.statics.getConversation = function(conversationId) {
  return this.find({ conversationId, isDeleted: false })
    .sort({ sentAt: 1 });
};

educationMessageSchema.statics.getUserMessages = function(userId) {
  return this.find({ userId, isDeleted: false })
    .sort({ sentAt: -1 });
};

educationMessageSchema.statics.getSchoolMessages = function(schoolId) {
  return this.find({ schoolId, isDeleted: false })
    .sort({ sentAt: -1 });
};

// Pre-save middleware
educationMessageSchema.pre('save', function(next) {
  if (this.isNew) {
    // Generate messageId if not provided
    if (!this.messageId) {
      this.messageId = new mongoose.Types.ObjectId().toString();
    }
    
    // Generate conversationId for new conversations
    if (!this.conversationId && !this.isReply) {
      this.conversationId = `${this.userId}_${this.programId}_${Date.now()}`;
    }
  }
  next();
});

module.exports = mongoose.model('EducationMessage', educationMessageSchema);