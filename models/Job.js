const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    minlength: 3
  },
  company: {
    type: String,
    required: [true, 'Company name is required'],
    trim: true,
    minlength: 2
  },
  category: {
    type: String,
    trim: true,
    default: 'Engineering'
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'Job type is required'],
    trim: true
  },
  salary: {
    type: String,
    trim: true,
    default: 'Competitive / Negotiable'
  },
  experience: {
    type: String,
    trim: true,
    default: 'Not specified'
  },
  skills: {
    type: [String],
    default: []
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    minlength: 15
  },
  requirements: {
    type: String,
    required: [true, 'Requirements are required'],
    trim: true,
    minlength: 10
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  postedAt: {
    type: String,
    default: () => new Date().toISOString().split('T')[0]
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Backward-compatible JSON transform so `id` maps to `jobId`
jobSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret.jobId;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.models.Job || mongoose.model('Job', jobSchema);
