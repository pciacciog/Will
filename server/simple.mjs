import express, { type Request, Response, NextFunction } from "express";
// importroutes";
// importvite";
// importscheduler";

const app = express();

// Configure app to be publicly accessible
app.use((req, res, next) => {
  res.header('X-Replit-Public', 'true');
  
  // Allow specific origins for mobile app with credentials
  const allowedOrigins = [
    'https://willbeta.replit.app',
    'capacitor://localhost',
    'http://localhost',
    'ionic://localhost',
    'https://localhost'
  ];
  
  const origin = req.get('Origin');
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else {
    res.header('Access-Control-Allow-Origin', 'https://willbeta.replit.app');
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
    <ul>
        <li>Account management and authentication</li>
        <li>Circle functionality and commitment tracking</li>
        <li>Video sessions for End Room reflection</li>
    </ul>

    <h2>3. Information Sharing</h2>
    <p><strong>We do not sell, trade, or share your personal information with third parties.</strong></p>
    <p>Your information is only shared within your accountability circle. Your "Why" motivations are private and only visible to you.</p>

    <h2>4. Data Security</h2>
    <p>All data is transmitted using HTTPS encryption and stored securely. Passwords are hashed and never stored in plain text.</p>

    <h2>5. Your Rights</h2>
    <ul>
        <li>View and update your account information</li>
        <li>Leave circles or delete your account</li>
        <li>Request a copy of your data</li>
    </ul>

    <h2>6. Contact Us</h2>
    <p>For questions about this privacy policy: privacy@willapp.com</p>
</body>
</html>
`;

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Serve privacy policy BEFORE API routes to avoid conflicts
app.get('/privacy-policy.html', (req, res) => {
  console.log('Privacy policy route hit!');
  res.setHeader('Content-Type', 'text/html');
  res.send(privacyPolicyHtml);
});

// Also serve at /api/privacy-policy as backup
app.get('/api/privacy-policy', (req, res) => {
  console.log('API Privacy policy route hit!');
  res.setHeader('Content-Type', 'text/html');
  res.send(privacyPolicyHtml);
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    // Start the End Room scheduler
    endRoomScheduler.start();
  });
})();
