require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');

const connectDB = require('./config/mongodb');
const User = require('./models/User');
const Job = require('./models/Job');
const Application = require('./models/Application');
const { authenticate, optionalAuth, authorize, JWT_SECRET } = require('./middleware/auth');
const seedInitialData = require('./services/seed');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure database connection on each API request (essential for Vercel serverless)
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection error in middleware:', err.message);
    res.status(500).json({
      success: false,
      error: 'Database connection failed. Please ensure MONGODB_URI is configured correctly in environment variables.'
    });
  }
});

// ─── VALIDATION HELPERS ───────────────────────────────────────────────────────
const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

const isValidIndianPhone = (phone) => {
  const re = /^[6-9]\d{9}$/;
  return re.test(String(phone).trim());
};

const isValidUrl = (urlStr) => {
  if (!urlStr || urlStr.trim() === '') return true; // Optional
  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

// ─── AUTHENTICATION ROUTES ───────────────────────────────────────────────────

// 1. POST /api/auth/signup — Register Candidate (User) or Recruiter
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, role, company } = req.body;
    const errors = {};

    if (!name || name.trim().length < 2) errors.name = 'Full name must be at least 2 characters.';
    if (!email || !isValidEmail(email)) errors.email = 'Please provide a valid email address.';
    if (!password || password.length < 6) errors.password = 'Password must be at least 6 characters.';

    if (role === 'admin') {
      return res.status(400).json({
        success: false,
        error: 'Administrator accounts cannot be registered publicly.'
      });
    }

    const selectedRole = role === 'recruiter' ? 'recruiter' : 'user';

    if (selectedRole === 'recruiter' && (!company || company.trim().length < 2)) {
      errors.company = 'Company name is required for recruiter registration.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        errors: { email: 'An account with this email address already exists.' }
      });
    }

    const newUser = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: selectedRole,
      company: company ? company.trim() : ''
    });

    const token = jwt.sign(
      {
        userId: newUser._id,
        email: newUser.email,
        role: newUser.role,
        name: newUser.name,
        company: newUser.company
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        company: newUser.company
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, error: 'Registration failed due to server error.' });
  }
});

// 2. POST /api/auth/login — Login with email and password
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide both email and password.'
      });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        company: user.company
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company: user.company
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Login failed due to server error.' });
  }
});

// 3. GET /api/auth/me — Get profile of currently logged-in user
app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User profile not found.' });
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch user profile.' });
  }
});

// ─── JOB MANAGEMENT ROUTES ────────────────────────────────────────────────────

// 4. GET /api/stats — Portal statistics
app.get('/api/stats', async (req, res) => {
  try {
    const totalJobs = await Job.countDocuments();
    const totalApplications = await Application.countDocuments();
    const shortlistedCount = await Application.countDocuments({ status: 'Shortlisted' });
    const pendingCount = await Application.countDocuments({ status: 'Pending' });
    const underReviewCount = await Application.countDocuments({ status: 'Under Review' });

    const categoriesAgg = await Job.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const categories = {};
    categoriesAgg.forEach(cat => {
      categories[cat._id || 'General'] = cat.count;
    });

    res.json({
      totalJobs,
      totalApplications,
      shortlistedCount,
      pendingCount,
      underReviewCount,
      categories
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ success: false, error: 'Failed to load statistics.' });
  }
});

// 5. GET /api/jobs — Filter & list jobs
app.get('/api/jobs', optionalAuth, async (req, res) => {
  try {
    const { search, type, category, location, recruiterOnly } = req.query;
    const filter = {};

    if (search && search.trim() !== '') {
      const q = search.trim();
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { company: { $regex: q, $options: 'i' } },
        { location: { $regex: q, $options: 'i' } },
        { skills: { $regex: q, $options: 'i' } }
      ];
    }

    if (type && type.trim() !== '') {
      filter.type = { $regex: `^${type.trim()}$`, $options: 'i' };
    }

    if (category && category.trim() !== '') {
      filter.category = { $regex: `^${category.trim()}$`, $options: 'i' };
    }

    if (location && location.trim() !== '') {
      filter.location = { $regex: location.trim(), $options: 'i' };
    }

    // If recruiter requests only their posted jobs
    if (recruiterOnly === 'true' && req.user && req.user.role === 'recruiter') {
      filter.postedBy = req.user.userId;
    }

    const jobs = await Job.find(filter).sort({ createdAt: -1 });
    res.json(jobs.map(j => j.toJSON()));
  } catch (err) {
    console.error('Error fetching jobs:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve jobs.' });
  }
});

// 6. GET /api/jobs/:id — Single job details
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findOne({ jobId: req.params.id });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job posting not found.' });
    }
    res.json({ success: true, job: job.toJSON() });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to retrieve job details.' });
  }
});

// 7. POST /api/jobs — Recruiter or Admin publishes a job
app.post('/api/jobs', authenticate, authorize('recruiter', 'admin'), async (req, res) => {
  try {
    const { title, company, category, location, type, salary, experience, skills, description, requirements } = req.body;
    const errors = {};

    if (!title || title.trim().length < 3) errors.title = 'Title must be at least 3 characters long.';
    if (!company || company.trim().length < 2) errors.company = 'Company name is required.';
    if (!location || location.trim().length < 2) errors.location = 'Job location is required.';
    if (!type || type.trim() === '') errors.type = 'Please select a valid job type.';
    if (!description || description.trim().length < 15) errors.description = 'Description must be at least 15 characters.';
    if (!requirements || requirements.trim().length < 10) errors.requirements = 'Requirements must be at least 10 characters.';

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const skillsArray = Array.isArray(skills)
      ? skills
      : (skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : []);

    const newJob = await Job.create({
      jobId: 'job_' + Date.now(),
      title: title.trim(),
      company: company.trim(),
      category: category && category.trim() !== '' ? category.trim() : 'Engineering',
      location: location.trim(),
      type: type.trim(),
      salary: salary && salary.trim() !== '' ? salary.trim() : 'Competitive / Negotiable',
      experience: experience && experience.trim() !== '' ? experience.trim() : 'Not specified',
      skills: skillsArray,
      description: description.trim(),
      requirements: requirements.trim(),
      postedBy: req.user.userId,
      postedAt: new Date().toISOString().split('T')[0]
    });

    res.status(201).json({
      success: true,
      message: 'Job posted successfully!',
      job: newJob.toJSON()
    });
  } catch (err) {
    console.error('Job creation error:', err);
    res.status(500).json({ success: false, error: 'Error creating job listing.' });
  }
});

// 8. DELETE /api/jobs/:id — Delete job and cascade applications
app.delete('/api/jobs/:id', authenticate, authorize('recruiter', 'admin'), async (req, res) => {
  try {
    const job = await Job.findOne({ jobId: req.params.id });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found.' });
    }

    // Recruiters can only delete jobs they posted; Admins can delete any
    if (req.user.role === 'recruiter' && job.postedBy && String(job.postedBy) !== String(req.user.userId)) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: You can only delete jobs posted by your own account.'
      });
    }

    // Cascade delete associated applications
    await Application.deleteMany({ jobId: req.params.id });
    await Job.deleteOne({ jobId: req.params.id });

    res.json({
      success: true,
      message: 'Job and associated applications deleted successfully!'
    });
  } catch (err) {
    console.error('Job deletion error:', err);
    res.status(500).json({ success: false, error: 'Error deleting job.' });
  }
});

// ─── CANDIDATE APPLICATIONS ROUTES ───────────────────────────────────────────

// 9. POST /api/apply — Candidate submits application (Candidate/User role only)
app.post('/api/apply', authenticate, authorize('user'), async (req, res) => {
  try {
    const { jobId, name, email, phone, experience, qualification, resumeUrl, coverLetter } = req.body;
    const errors = {};

    if (!jobId) errors.jobId = 'Target Job ID is required.';
    if (!name || name.trim().length < 3) errors.name = 'Full name must contain at least 3 characters.';
    const candidateEmail = (email && email.trim() !== '') ? email.trim().toLowerCase() : req.user.email.toLowerCase();
    if (!candidateEmail || !isValidEmail(candidateEmail)) errors.email = 'Please provide a valid email address.';
    if (!phone || !isValidIndianPhone(phone)) errors.phone = 'Enter a valid 10-digit Indian phone number (starting 6-9).';
    if (!qualification || qualification.trim().length < 2) errors.qualification = 'Please select or enter your qualification.';
    if (resumeUrl && !isValidUrl(resumeUrl)) errors.resumeUrl = 'Resume URL must start with http:// or https://';

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const targetJob = await Job.findOne({ jobId: String(jobId) });
    if (!targetJob) {
      return res.status(404).json({ success: false, error: 'Job listing does not exist.' });
    }

    // Check if candidate already applied to this job
    const alreadyApplied = await Application.findOne({
      jobId: String(jobId),
      $or: [
        { applicantId: req.user.userId },
        { email: candidateEmail }
      ]
    });

    if (alreadyApplied) {
      return res.status(400).json({
        success: false,
        error: 'You have already submitted an application for this position. View status in My Applications.'
      });
    }

    const newApp = await Application.create({
      applicationId: 'app_' + Date.now(),
      jobId: String(jobId),
      jobTitle: targetJob.title,
      company: targetJob.company,
      applicantId: req.user.userId,
      name: name.trim(),
      email: candidateEmail,
      phone: phone.trim(),
      experience: experience ? String(experience).trim() : '0',
      qualification: qualification.trim(),
      resumeUrl: resumeUrl ? resumeUrl.trim() : '',
      coverLetter: coverLetter ? coverLetter.trim() : 'No cover letter provided.',
      status: 'Pending',
      appliedAt: new Date().toISOString().split('T')[0]
    });

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully! Recruiter has been notified.',
      application: newApp.toJSON()
    });
  } catch (err) {
    console.error('Application submission error:', err);
    res.status(500).json({ success: false, error: 'Error submitting application.' });
  }
});

// 10. GET /api/applications — Role-filtered applications
app.get('/api/applications', authenticate, async (req, res) => {
  try {
    const { jobId, status, search } = req.query;
    const filter = {};

    // Role-based visibility isolation:
    if (req.user.role === 'user') {
      // Candidates only see their own applications
      filter.$or = [
        { applicantId: req.user.userId },
        { email: req.user.email.toLowerCase() }
      ];
    } else if (req.user.role === 'recruiter') {
      // Recruiters see applications for jobs they posted
      const myJobs = await Job.find({ postedBy: req.user.userId }).select('jobId');
      const myJobIds = myJobs.map(j => j.jobId);
      // If recruiter has posted jobs, filter by those. If none, allow legacy jobs or empty
      if (myJobIds.length > 0) {
        filter.jobId = { $in: myJobIds };
      }
    }
    // Admins see all applications with no restriction

    if (jobId) {
      filter.jobId = String(jobId);
    }

    if (status && status !== 'All') {
      filter.status = status;
    }

    if (search && search.trim() !== '') {
      const q = search.trim();
      const searchConditions = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { jobTitle: { $regex: q, $options: 'i' } },
        { company: { $regex: q, $options: 'i' } }
      ];

      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    const apps = await Application.find(filter).sort({ createdAt: -1 });
    res.json(apps.map(a => a.toJSON()));
  } catch (err) {
    console.error('Applications fetch error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve applications.' });
  }
});

// 11. PATCH /api/applications/:id/status — Recruiter/Admin updates candidate status
app.patch('/api/applications/:id/status', authenticate, authorize('recruiter', 'admin'), async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['Pending', 'Under Review', 'Shortlisted', 'Rejected', 'Offered'];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}`
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const appDoc = await Application.findOneAndUpdate(
      { applicationId: req.params.id },
      { status, updatedAt: today },
      { new: true }
    );

    if (!appDoc) {
      return res.status(404).json({ success: false, error: 'Application record not found.' });
    }

    res.json({
      success: true,
      message: `Application status updated to "${status}"`,
      application: appDoc.toJSON()
    });
  } catch (err) {
    console.error('Status update error:', err);
    res.status(500).json({ success: false, error: 'Failed to update application status.' });
  }
});

// 12. DELETE /api/applications/:id — Delete application
app.delete('/api/applications/:id', authenticate, authorize('recruiter', 'admin'), async (req, res) => {
  try {
    const result = await Application.deleteOne({ applicationId: req.params.id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'Application not found.' });
    }
    res.json({ success: true, message: 'Application deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete application.' });
  }
});

// ─── ADMIN USER MANAGEMENT ───────────────────────────────────────────────────

// 13. GET /api/admin/users — List registered users and recruiters
app.get('/api/admin/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch user accounts.' });
  }
});

// 14. DELETE /api/admin/users/:id — Remove a user account
app.delete('/api/admin/users/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    if (String(req.user.userId) === String(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Admin cannot delete their own account.' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User account removed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete user account.' });
  }
});

// Serverless / Local Runner
async function initServer() {
  try {
    if (process.env.MONGODB_URI) {
      await connectDB();
      await seedInitialData();
    }
  } catch (err) {
    console.warn('[Server] MongoDB connection will be re-attempted on request:', err.message);
  }
}

initServer();

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  JobConnect Full-Stack Server Running (MongoDB / Vercel ready)!`);
    console.log(`  Local URL: http://localhost:${PORT}`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
