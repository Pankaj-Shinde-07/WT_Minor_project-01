const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  applicationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  jobId: {
    type: String,
    required: true,
    index: true
  },
  jobTitle: {
    type: String,
    required: true
  },
  company: {
    type: String,
    required: true
  },
  applicantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  name: {
    type: String,
    required: [true, 'Candidate name is required'],
    trim: true,
    minlength: 3
  },
  email: {
    type: String,
    required: [true, 'Candidate email is required'],
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: [true, 'Contact phone is required'],
    trim: true
  },
  experience: {
    type: String,
    trim: true,
    default: '0'
  },
  qualification: {
    type: String,
    required: true,
    trim: true
  },
  resumeUrl: {
    type: String,
    trim: true,
    default: ''
  },
  coverLetter: {
    type: String,
    trim: true,
    default: 'No cover letter provided.'
  },
  status: {
    type: String,
    enum: ['Pending', 'Under Review', 'Shortlisted', 'Rejected', 'Offered'],
    default: 'Pending',
    index: true
  },
  appliedAt: {
    type: String,
    default: () => new Date().toISOString().split('T')[0]
  },
  updatedAt: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Backward-compatible JSON transform so `id` maps to `applicationId`
applicationSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret.applicationId;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.models.Application || mongoose.model('Application', applicationSchema);
