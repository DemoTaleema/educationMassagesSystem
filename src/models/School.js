const mongoose = require('mongoose');

// School Schema for managing education providers
const schoolSchema = new mongoose.Schema({
  schoolId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  schoolName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    zipCode: String,
    country: { type: String, default: 'Sweden' }
  },
  website: {
    type: String,
    trim: true
  },
  // Authentication for future school portals
  credentials: {
    username: {
      type: String,
      unique: true,
      sparse: true // Allow null values but unique when present
    },
    passwordHash: String,
    isActive: { type: Boolean, default: false },
    lastLogin: Date
  },
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  isVerified: { type: Boolean, default: false },
  programs: [String] // Array of program IDs they offer
}, {
  timestamps: true
});

// Indexes for performance
schoolSchema.index({ schoolName: 1 });
schoolSchema.index({ email: 1 });
schoolSchema.index({ 'credentials.username': 1 });

module.exports = mongoose.model('School', schoolSchema);