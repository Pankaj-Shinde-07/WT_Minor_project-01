const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Job = require('../models/Job');
const Application = require('../models/Application');

async function seedInitialData() {
  try {
    // 1. Ensure Default Admin User exists
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@jobconnect.com';
    const adminExists = await User.findOne({ email: adminEmail.toLowerCase() });
    if (!adminExists) {
      await User.create({
        name: process.env.ADMIN_NAME || 'System Administrator',
        email: adminEmail.toLowerCase(),
        password: process.env.ADMIN_PASSWORD || 'Admin@12345',
        role: 'admin',
        company: 'JobConnect Platform'
      });
      console.log(`[Seed] Default Admin created: ${adminEmail}`);
    }

    // 2. Ensure Sample Recruiter exists
    const recruiterEmail = 'recruiter@demo.com';
    let demoRecruiter = await User.findOne({ email: recruiterEmail });
    if (!demoRecruiter) {
      demoRecruiter = await User.create({
        name: 'Sarah Jenkins',
        email: recruiterEmail,
        password: 'Password@123',
        role: 'recruiter',
        company: 'Google Cloud'
      });
      console.log(`[Seed] Demo Recruiter created: ${recruiterEmail}`);
    }

    // 3. Ensure Sample Candidate exists
    const candidateEmail = 'candidate@demo.com';
    let demoCandidate = await User.findOne({ email: candidateEmail });
    if (!demoCandidate) {
      demoCandidate = await User.create({
        name: 'Pankaj Shinde',
        email: candidateEmail,
        password: 'Password@123',
        role: 'user',
        company: ''
      });
      console.log(`[Seed] Demo Candidate created: ${candidateEmail}`);
    }

    // 4. Seed Jobs if collection is empty
    const jobCount = await Job.countDocuments();
    if (jobCount === 0) {
      console.log('[Seed] Seeding sample jobs from db.json...');
      let seedData = null;
      const dbPath = path.join(__dirname, '..', 'db.json');
      const dbSeedPath = path.join(__dirname, '..', 'db.example.json');

      if (fs.existsSync(dbPath)) {
        try {
          seedData = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
        } catch {}
      }
      if (!seedData && fs.existsSync(dbSeedPath)) {
        seedData = JSON.parse(fs.readFileSync(dbSeedPath, 'utf-8'));
      }

      if (seedData && Array.isArray(seedData.jobs)) {
        for (const j of seedData.jobs) {
          await Job.create({
            jobId: String(j.id),
            title: j.title,
            company: j.company,
            category: j.category || 'Engineering',
            location: j.location,
            type: j.type || 'Full-time',
            salary: j.salary || 'Competitive / Negotiable',
            experience: j.experience || 'Not specified',
            skills: Array.isArray(j.skills) ? j.skills : [],
            description: j.description,
            requirements: j.requirements,
            postedBy: demoRecruiter._id,
            postedAt: j.postedAt || new Date().toISOString().split('T')[0]
          });
        }
        console.log(`[Seed] Seeded ${seedData.jobs.length} jobs.`);
      }

      // Seed Applications if collection is empty
      const appCount = await Application.countDocuments();
      if (appCount === 0 && seedData && Array.isArray(seedData.applications)) {
        for (const a of seedData.applications) {
          await Application.create({
            applicationId: String(a.id),
            jobId: String(a.jobId),
            jobTitle: a.jobTitle,
            company: a.company,
            applicantId: demoCandidate._id,
            name: a.name,
            email: a.email,
            phone: a.phone,
            experience: String(a.experience || '0'),
            qualification: a.qualification,
            resumeUrl: a.resumeUrl || '',
            coverLetter: a.coverLetter || 'No cover letter provided.',
            status: a.status || 'Pending',
            appliedAt: a.appliedAt || new Date().toISOString().split('T')[0],
            updatedAt: a.updatedAt || null
          });
        }
        console.log(`[Seed] Seeded ${seedData.applications.length} applications.`);
      }
    }
  } catch (err) {
    console.warn('[Seed] Note during data seeding:', err.message);
  }
}

module.exports = seedInitialData;
