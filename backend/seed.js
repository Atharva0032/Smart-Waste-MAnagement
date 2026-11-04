/**
 * Database seeder
 * ---------------------------------------------------------------------------
 * Creates the three demo accounts, their role profiles and a small set of
 * sample complaints so every dashboard has data on first run.
 *
 *   npm run seed            # create anything that is missing (safe to re-run)
 *   npm run seed -- --fresh # wipe Users/Complaints/Notifications first
 *
 * Demo credentials (override with the SEED_* variables in .env):
 *   admin@swms.gov  / Admin@123
 *   worker@swms.gov / Worker@123
 *   user@swms.gov   / User@123
 */
const fs = require('fs');
const path = require('path');

const env = require('./config/env');
const connectDB = require('./config/db');
const { disconnectDB } = require('./config/db');

const User = require('./models/User');
const Complaint = require('./models/Complaint');
const Worker = require('./models/Worker');
const Admin = require('./models/Admin');
const Notification = require('./models/Notification');

const FRESH = process.argv.includes('--fresh');

/**
 * Write a small stand-in image so seeded complaints render something in the UI
 * without shipping binary fixtures in the repository.
 */
const writePlaceholderImage = (filename, label, color) => {
  fs.mkdirSync(env.UPLOAD_PATH, { recursive: true });
  const target = path.join(env.UPLOAD_PATH, filename);
  if (fs.existsSync(target)) return `/uploads/${filename}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${color}"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#g)"/>
  <g fill="rgba(255,255,255,0.14)">
    <circle cx="180" cy="180" r="90"/><circle cx="620" cy="420" r="130"/>
    <rect x="300" y="120" width="220" height="220" rx="24"/>
  </g>
  <text x="400" y="320" font-family="Segoe UI, Arial, sans-serif" font-size="42"
        font-weight="700" fill="#ffffff" text-anchor="middle">${label}</text>
  <text x="400" y="366" font-family="Segoe UI, Arial, sans-serif" font-size="20"
        fill="rgba(255,255,255,0.75)" text-anchor="middle">Sample seed image</text>
</svg>`;

  fs.writeFileSync(target, svg, 'utf8');
  return `/uploads/${filename}`;
};

/**
 * Create or update a user by email. Passwords are always re-hashed by the
 * `pre('save')` hook, so the demo credentials stay valid after re-seeding.
 */
const upsertUser = async ({ name, email, password, role, phone, zone, address }) => {
  let user = await User.findOne({ email: String(email).toLowerCase() });

  if (!user) {
    user = await User.create({ name, email, password, role, phone, zone: zone || '', address: address || '' });
    console.log(`  + created ${role.padEnd(6)} ${email}`);
  } else {
    user.name = name;
    user.role = role;
    user.phone = phone;
    user.zone = zone || '';
    user.isActive = true;
    // Force the hook to re-hash by marking the field modified.
    user.password = password;
    await user.save();
    console.log(`  ~ updated ${role.padEnd(6)} ${email}`);
  }
  return user;
};

/** Minimal day offset helper for believable creation dates. */
const daysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const run = async () => {
  console.log('\n[seed] Connecting to MongoDB...');
  await connectDB();

  if (FRESH) {
    console.log('[seed] --fresh supplied: removing existing users, complaints and notifications.');
    await Promise.all([
      User.deleteMany({}),
      Complaint.deleteMany({}),
      Worker.deleteMany({}),
      Admin.deleteMany({}),
      Notification.deleteMany({}),
    ]);
  }

  /* ----------------------------- Accounts -------------------------------- */
  console.log('[seed] Accounts:');

  const adminUser = await upsertUser({
    name: 'Municipal Administrator',
    email: process.env.SEED_ADMIN_EMAIL || 'admin@swms.gov',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
    role: 'admin',
    phone: '+91 98000 11111',
  });

  const workerUser = await upsertUser({
    name: 'Ravi Kumar',
    email: process.env.SEED_WORKER_EMAIL || 'worker@swms.gov',
    password: process.env.SEED_WORKER_PASSWORD || 'Worker@123',
    role: 'worker',
    phone: '+91 98000 22222',
    zone: 'Zone A - North',
  });

  const worker2User = await upsertUser({
    name: 'Priya Sharma',
    email: 'worker2@swms.gov',
    password: 'Worker@123',
    role: 'worker',
    phone: '+91 98000 33333',
    zone: 'Zone C - East',
  });

  const citizenUser = await upsertUser({
    name: 'Aarav Mehta',
    email: process.env.SEED_USER_EMAIL || 'user@swms.gov',
    password: process.env.SEED_USER_PASSWORD || 'User@123',
    role: 'user',
    phone: '+91 98000 44444',
    address: '21 Marine Drive, Mumbai',
  });

  const citizen2User = await upsertUser({
    name: 'Neha Verma',
    email: 'citizen2@swms.gov',
    password: 'User@123',
    role: 'user',
    phone: '+91 98000 55555',
    address: '8 Park Street, Kolkata',
  });

  /* ------------------------------ Profiles ------------------------------- */
  console.log('[seed] Profiles:');

  await Admin.findOneAndUpdate(
    { user: adminUser._id },
    {
      user: adminUser._id,
      employeeId: 'ADM-0001',
      department: 'Municipal Solid Waste Department',
      designation: 'Chief Waste Management Officer',
      jurisdiction: 'All Zones',
      level: 'super',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log('  + admin profile ready');

  await Worker.findOneAndUpdate(
    { user: workerUser._id },
    { user: workerUser._id, employeeId: 'W-0001', zone: 'Zone A - North', totalAssigned: 0, totalResolved: 0 },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  await Worker.findOneAndUpdate(
    { user: worker2User._id },
    { user: worker2User._id, employeeId: 'W-0002', zone: 'Zone C - East', totalAssigned: 0, totalResolved: 0 },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log('  + worker profiles ready');

  /* ----------------------------- Complaints ------------------------------ */
  const existingCount = await Complaint.countDocuments();
  if (existingCount > 0) {
    console.log(`[seed] Complaints: ${existingCount} already present - skipping sample data.`);
  } else {
    console.log('[seed] Complaints:');

    const img1 = writePlaceholderImage('seed-plastic-pile.svg', 'Plastic waste', '#0ea5e9');
    const img2 = writePlaceholderImage('seed-organic-pile.svg', 'Organic waste', '#16a34a');
    const img3 = writePlaceholderImage('seed-ewaste-pile.svg', 'E-waste', '#8b5cf6');
    const img4 = writePlaceholderImage('seed-construction.svg', 'Construction debris', '#f59e0b');
    const done1 = writePlaceholderImage('seed-resolved.svg', 'Resolved', '#10b981');

    const samples = [
      {
        user: citizenUser._id,
        wasteType: 'plastic',
        description: 'Overflowing plastic waste bins behind the market complex, scattered across the footpath.',
        image: img1,
        location: { address: 'Sector 5 Market Road, Near Bus Depot', area: 'Zone A - North', latitude: 19.076, longitude: 72.8777 },
        status: 'pending',
        priority: 'high',
        createdAt: daysAgo(0),
      },
      {
        user: citizen2User._id,
        wasteType: 'organic',
        description: 'Vegetable and food waste dumped on the roadside, attracting stray animals.',
        image: img2,
        location: { address: '12 Lake View Street', area: 'Zone C - East', latitude: 22.5726, longitude: 88.3639 },
        status: 'assigned',
        priority: 'medium',
        assignedWorker: worker2User._id,
        createdAt: daysAgo(1),
      },
      {
        user: citizenUser._id,
        wasteType: 'electronic',
        description: 'Old television set and computer peripherals abandoned near the community park gate.',
        image: img3,
        location: { address: 'Community Park Gate 2, Sector 9', area: 'Zone A - North', latitude: 19.0896, longitude: 72.8656 },
        status: 'in_progress',
        priority: 'high',
        assignedWorker: workerUser._id,
        createdAt: daysAgo(2),
      },
      {
        user: citizen2User._id,
        wasteType: 'construction',
        description: 'Construction rubble and broken tiles left on the pedestrian walkway after renovation work.',
        image: img4,
        location: { address: 'Plot 44, Industrial Layout', area: 'Zone F - Industrial', latitude: 22.5958, longitude: 88.3697 },
        status: 'resolved',
        priority: 'low',
        assignedWorker: worker2User._id,
        completionImage: done1,
        resolutionNote: 'Rubble cleared and disposed at the authorised construction waste facility.',
        createdAt: daysAgo(5),
      },
      {
        user: citizenUser._id,
        wasteType: 'hazardous',
        description: 'Discarded paint containers and thinner cans leaking near the storm drain.',
        image: img1,
        location: { address: 'Drainage Junction, Old Mill Road', area: 'Zone D - West', latitude: 19.033, longitude: 72.8296 },
        status: 'rejected',
        priority: 'medium',
        createdAt: daysAgo(6),
        resolutionNote: 'Duplicate of an existing report (#SWM-DUP01) already under action.',
      },
    ];

    for (const sample of samples) {
      const complaint = new Complaint({
        trackingId: await Complaint.generateTrackingId(),
        user: sample.user,
        wasteType: sample.wasteType,
        description: sample.description,
        image: sample.image,
        completionImage: sample.completionImage || '',
        location: sample.location,
        status: sample.status,
        priority: sample.priority,
        assignedWorker: sample.assignedWorker || null,
        assignedAt: sample.assignedWorker ? daysAgo(1) : null,
        resolutionNote: sample.resolutionNote || '',
        resolvedAt: sample.status === 'resolved' ? daysAgo(4) : null,
        rejectedAt: sample.status === 'rejected' ? daysAgo(6) : null,
        aiVerification: {
          isWaste: sample.status !== 'rejected',
          confidence: sample.status === 'rejected' ? 34 : 78 + Math.floor(Math.random() * 18),
          label: sample.wasteType,
          model: 'seed-data',
          verifiedAt: sample.createdAt,
        },
        timeline: [
          { status: 'pending', note: 'Complaint submitted by citizen.', updatedBy: sample.user, timestamp: sample.createdAt },
          ...(sample.assignedWorker
            ? [{ status: 'assigned', note: 'Assigned to a field worker.', updatedBy: adminUser._id, timestamp: daysAgo(1) }]
            : []),
          ...(['in_progress', 'resolved'].includes(sample.status)
            ? [{ status: 'in_progress', note: 'Field work has started.', updatedBy: sample.assignedWorker, timestamp: daysAgo(2) }]
            : []),
          ...(sample.status === 'resolved'
            ? [{ status: 'resolved', note: sample.resolutionNote, updatedBy: sample.assignedWorker, timestamp: daysAgo(4) }]
            : []),
          ...(sample.status === 'rejected'
            ? [{ status: 'rejected', note: sample.resolutionNote, updatedBy: adminUser._id, timestamp: daysAgo(6) }]
            : []),
        ],
      });

      complaint.createdAt = sample.createdAt;
      complaint.updatedAt = sample.createdAt;
      await complaint.save({ timestamps: false });
      console.log(`  + ${complaint.trackingId} (${sample.status})`);
    }

    // Keep the denormalised workload counters consistent with the seed data.
    await Worker.bumpCounters(workerUser._id, { assigned: 1 });
    await Worker.bumpCounters(worker2User._id, { assigned: 2, resolved: 1 });

    /* --------------------------- Notifications --------------------------- */
    await Notification.create({
      recipient: adminUser._id,
      title: 'Welcome to the Municipal Control Center',
      message: 'Sample complaints have been loaded. Assign workers and track resolution from the dashboard.',
      type: 'system',
      link: '/admin',
    });
    await Notification.create({
      recipient: citizenUser._id,
      title: 'Your report is being processed',
      message: 'A field worker has been assigned to your E-waste report. You will be notified on resolution.',
      type: 'status_update',
      link: '/complaints',
    });
    console.log('[seed] Notifications: 2 created');
  }

  /* -------------------------------- Done --------------------------------- */
  console.log('\n[seed] Completed successfully.\n');
  console.log('  Demo credentials');
  console.log('  ------------------------------------------------------------');
  console.log('  Administrator : admin@swms.gov  / Admin@123');
  console.log('  Field worker  : worker@swms.gov / Worker@123');
  console.log('  Field worker  : worker2@swms.gov / Worker@123');
  console.log('  Citizen       : user@swms.gov   / User@123');
  console.log('  Citizen       : citizen2@swms.gov / User@123');
  console.log('  ------------------------------------------------------------\n');

  await disconnectDB();
};

module.exports = { run };

// Only auto-run (and exit) when executed directly, so the in-memory development
// launcher can import `run` and seed without terminating the process.
if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch(async (error) => {
      console.error('\n[seed] Failed:', error.message);
      if (env.NODE_ENV !== 'production') console.error(error.stack);
      await disconnectDB().catch(() => {});
      process.exit(1);
    });
}
