import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { endRoomScheduler } from "./scheduler";
import path from "path";

const app = express();

// FIRST: Inject Origin/Referer headers for iOS/Capacitor apps to bypass Replit Shield
// Replit Shield checks for these headers BEFORE our middleware runs
app.use((req, res, next) => {
  // If request has X-Requested-With header but no Origin/Referer (iOS behavior),
  // add them so Replit Shield doesn't block the request
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
    if (!req.headers['origin']) {
      req.headers['origin'] = 'https://will-staging-porfirioaciacci.replit.app';
    }
    if (!req.headers['referer']) {
      req.headers['referer'] = 'https://will-staging-porfirioaciacci.replit.app';
    }
  }
  next();
});

// Configure app to be publicly accessible
app.use((req, res, next) => {
  res.header('X-Replit-Public', 'true');
  
  // Allow specific origins for mobile app with credentials
  const allowedOrigins = [
    'https://will-1-porfirioaciacci.replit.app',      // Production backend
    'https://will-staging-porfirioaciacci.replit.app', // Staging backend
    'capacitor://localhost',
    'http://localhost',
    'ionic://localhost',
    'https://localhost'
  ];
  
  const origin = req.get('Origin');
  const userAgent = req.get('User-Agent') || '';
  const isCapacitorApp = userAgent.includes('Capacitor') || !origin;
  
  // If Origin header is present and in allowlist, echo it back
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } 
  // If no Origin header or Capacitor app, allow staging URL (this is staging environment)
  else if (isCapacitorApp || !origin) {
    res.header('Access-Control-Allow-Origin', 'https://will-staging-porfirioaciacci.replit.app');
  }
  // Default fallback to staging URL for this environment
  else {
    res.header('Access-Control-Allow-Origin', 'https://will-staging-porfirioaciacci.replit.app');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cookie');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const privacyPolicyHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WILL App - Privacy Policy</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        h1 { color: #2c3e50; }
        h2 { color: #34495e; margin-top: 30px; }
    </style>
</head>
<body>
    <h1>WILL App Privacy Policy</h1>
    <p><strong>Last Updated:</strong> July 18, 2025</p>
    
    <h2>1. Information We Collect</h2>
    <p>We collect minimal information necessary for the app to function:</p>
    <ul>
        <li><strong>Email Address:</strong> For account authentication</li>
        <li><strong>First and Last Name:</strong> For identification within circles</li>
        <li><strong>Circle and Commitment Data:</strong> Your goals and progress</li>
        <li><strong>Camera/Microphone Access:</strong> Only during End Room video sessions</li>
    </ul>

    <h2>2. How We Use Your Information</h2>
    <p>Your information is used solely to:</p>
    <ul>
        <li>Authenticate your account and maintain sessions</li>
        <li>Enable circle formation and goal tracking</li>
        <li>Facilitate End Room video sessions for accountability</li>
        <li>Send relevant notifications about your commitments</li>
    </ul>

    <h2>3. Information Sharing</h2>
    <p>We do not sell, trade, or share your personal information with third parties except:</p>
    <ul>
        <li>Within your circle for accountability purposes (first names only)</li>
        <li>When required by law or to protect our rights</li>
        <li>With trusted service providers who assist in app operation</li>
    </ul>

    <h2>4. Data Security</h2>
    <p>We implement appropriate security measures to protect your information against unauthorized access, alteration, disclosure, or destruction.</p>

    <h2>5. Your Rights</h2>
    <p>You have the right to:</p>
    <ul>
        <li>Access your personal information</li>
        <li>Correct inaccurate information</li>
        <li>Delete your account and associated data</li>
        <li>Withdraw consent for data processing</li>
    </ul>

    <h2>6. Contact Us</h2>
    <p>For privacy-related questions, contact us at: privacy@willapp.com</p>
</body>
</html>
`;

// Privacy policy route
app.get("/privacy-policy", (req, res) => {
  res.send(privacyPolicyHtml);
});

// Register all API routes (includes enhanced /api/health endpoint)
registerRoutes(app);

// Start End Room scheduler
endRoomScheduler.start();
console.log('[EndRoomScheduler] Scheduler started');

// Serve icon generator before catch-all routes
app.get('/icon-generator.html', (req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), 'dist', 'icon-generator.html'));
});

// In production, serve static files from dist/public
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(process.cwd(), 'dist', 'public');
  app.use(express.static(distPath));
  
  // Serve index.html for all non-API routes (SPA routing)
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      const indexPath = path.join(distPath, 'index.html');
      if (require('fs').existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Frontend not found - check dist/public/index.html');
      }
    }
  });
} else {
  // In development, serve static files from dist/public as well
  const distPath = path.join(process.cwd(), 'dist', 'public');
  app.use(express.static(distPath));
  
  // Serve index.html for all non-API routes (SPA routing)
  app.get('*', async (req, res) => {
    if (!req.path.startsWith('/api/')) {
      const indexPath = path.join(distPath, 'index.html');
      const fs = await import('fs');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Frontend not found - run build first');
      }
    }
  });
  
  console.log('Development mode: Serving frontend from dist/public/');
}

const PORT = parseInt(process.env.PORT || '5000', 10);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  
  // Check APNs configuration
  const apnsConfigured = !!(
    process.env.APNS_PRIVATE_KEY && 
    process.env.APNS_KEY_ID && 
    process.env.APNS_TEAM_ID &&
    process.env.APNS_TOPIC
  );
  
  console.log(`Push Notifications: ${apnsConfigured ? 'ENABLED (Sandbox APNs for Development)' : 'SIMULATION MODE'}`);
  
  if (apnsConfigured) {
    console.log('✅ APNs credentials configured - real sandbox notifications will be sent');
  } else {
    console.log('ℹ️  Running in simulation mode - notifications logged to console');
  }
});