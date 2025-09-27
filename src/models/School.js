const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: String,
  address: String,
  city: String,
  country: String,
  phone: String,
  email: String,
  website: String,
  established: String,
  schoolType: {
    type: String,
    enum: ['university', 'college', 'high_school', 'primary_school', 'vocational'],
    default: 'university'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('School', schoolSchema);