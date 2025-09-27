const mongoose = require('mongoose');

const educationMessageSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true
  },
  schoolId: {
    type: String,
    required: true
  },
  schoolName: {
    type: String
  },
  studentName: {
    type: String,
    required: true
  },
  studentEmail: {
    type: String,
    required: true
  },
  studentPhone: {
    type: String
  },
  programId: {
    type: String
  },
  programTitle: {
    type: String
  },
  message: {
    type: String,
    required: true
  },
  messageType: {
    type: String,
    enum: ['general', 'admissions', 'support', 'complaint', 'inquiry'],
    default: 'general'
  },
  urgencyLevel: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  status: {
    type: String,
    enum: ['unread', 'read', 'replied', 'closed'],
    default: 'unread'
  },
  isFromStudent: {
    type: Boolean,
    default: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  reply: {
    type: String,
    default: ''
  },
  adminId: {
    type: String
  },
  adminName: {
    type: String
  },
  replyTimestamp: {
    type: Date
  },
  readBy: {
    type: String
  },
  readByName: {
    type: String
  },
  readTimestamp: {
    type: Date
  },
  adminNotes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
educationMessageSchema.index({ studentId: 1, timestamp: -1 });
educationMessageSchema.index({ schoolId: 1, status: 1 });
educationMessageSchema.index({ status: 1, timestamp: -1 });

const EducationMessage = mongoose.model('EducationMessage', educationMessageSchema);

module.exports = { EducationMessage };