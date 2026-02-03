// index.js - Entry point for Modern College LMS
// Works on both Railway and Localhost

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const pool = require('./db');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');

const app = express();

// ================= CONFIGURATION =================
const JWT_SECRET = process.env.JWT_SECRET || "mysecretkey1234567890securekey";
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";
const BASE_URL = process.env.RAILWAY_STATIC_URL || `http://localhost:${PORT}`;

console.log(`🚀 Modern College LMS Starting...`);
console.log(`🌍 Environment: ${NODE_ENV}`);
console.log(`📍 Port: ${PORT}`);
console.log(`🔗 Base URL: ${BASE_URL}`);

// ================= MIDDLEWARE =================
// CORS Configuration for both Railway and localhost
const allowedOrigins = [
  'https://modern-college-lms-production.up.railway.app',
  'https://modern-college-lms.up.railway.app',
  'https://*.railway.app',
  'http://localhost:5000',
  'http://localhost:3000',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || 
        origin.includes('railway.app') || 
        origin.includes('localhost') || 
        origin.includes('127.0.0.1')) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= SERVE STATIC FILES =================
app.use(express.static(path.join(__dirname, "public")));

// ================= SMTP CONFIG =================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER || "lms987565@gmail.com",
    pass: process.env.SMTP_PASS || "mszc glaz lxdg aoti"
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Test email connection
transporter.verify(function(error, success) {
  if (error) {
    console.log("⚠️ SMTP Connection Warning:", error.message);
    console.log("📧 Emails may not work. Check SMTP_USER and SMTP_PASS environment variables.");
  } else {
    console.log("✅ SMTP Server is ready to send emails");
  }
});

// ================= DATABASE CONNECTION TEST =================
async function testDatabaseConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL database');
    const result = await client.query('SELECT NOW()');
    console.log('🗄️  Database time:', result.rows[0].now);
    client.release();
  } catch (err) {
    console.log('⚠️ Database connection warning:', err.message);
    console.log('ℹ️  Some features may not work without database connection.');
    console.log('ℹ️  Set DATABASE_URL environment variable for full functionality.');
  }
}

// ================= STUDENT CODE GENERATOR =================
function generateStudentCode(row) {
  const rollNo = row.roll_no ? row.roll_no.toString().trim() : '000';
  const dept = row.department ? row.department.trim() : '';
  const stream = row.stream ? row.stream.trim() : '';
  const division = row.division ? row.division.trim() : '';
  const semester = row.semester ? row.semester.toString().trim() : '';
  const year = row.academic_year ? row.academic_year.trim() : '';
  
  // Create code parts
  const deptCode = dept ? dept.substring(0, 3).toUpperCase().replace(/\s/g, '') : 'GEN';
  const streamCode = stream ? stream.substring(0, 3).toUpperCase().replace(/\s/g, '') : 'GEN';
  const divCode = division ? division.toUpperCase() : 'X';
  const semCode = semester || '0';
  
  // Extract year (handle formats like "2025-26", "2025", "25-26")
  let yearCode = '00';
  if (year) {
    const match = year.match(/\d{2}/);
    if (match) yearCode = match[0];
  }
  
  // Roll number (pad to 3 digits)
  const rollNum = rollNo.padStart(3, '0');
  
  // Assemble: Use only what exists
  const parts = [];
  if (deptCode) parts.push(deptCode);
  if (streamCode && streamCode !== deptCode) parts.push(streamCode);
  if (divCode) parts.push(divCode);
  if (semCode && semCode !== '0') parts.push(semCode);
  if (yearCode && yearCode !== '00') parts.push(yearCode);
  parts.push(rollNum);
  
  return parts.join('-');
}

// ================= JWT MIDDLEWARE =================
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: "Access denied. No token provided." 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false,
        message: "Invalid or expired token" 
      });
    }
    req.user = user;
    next();
  });
}

// ================= BASIC ROUTES =================

// Root route - Welcome page
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Modern College LMS</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #1a237e 0%, #283593 100%);
          color: white;
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          text-align: center;
          margin: 0;
          padding: 20px;
        }
        .container {
          background: rgba(255, 255, 255, 0.1);
          padding: 50px;
          border-radius: 20px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          max-width: 600px;
          width: 100%;
        }
        h1 { 
          font-size: 2.8em; 
          margin-bottom: 20px;
          color: #fff;
          text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
        }
        .status {
          background: rgba(0, 255, 0, 0.2);
          padding: 15px;
          border-radius: 10px;
          margin: 25px 0;
          font-size: 1.2em;
          border: 2px solid rgba(0, 255, 0, 0.3);
        }
        .btn {
          display: inline-block;
          padding: 15px 35px;
          background: white;
          color: #1a237e;
          text-decoration: none;
          border-radius: 10px;
          font-weight: bold;
          margin: 15px;
          transition: all 0.3s;
          border: 2px solid white;
          font-size: 16px;
        }
        .btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
          background: #f8f9fa;
        }
        .btn.secondary {
          background: transparent;
          color: white;
          border: 2px solid rgba(255, 255, 255, 0.3);
        }
        .btn.secondary:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .info {
          margin-top: 30px;
          font-size: 14px;
          opacity: 0.8;
          background: rgba(0, 0, 0, 0.2);
          padding: 15px;
          border-radius: 8px;
        }
        .environment {
          display: inline-block;
          padding: 5px 15px;
          background: #4CAF50;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
          margin-left: 10px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎓 Modern College LMS</h1>
        <div class="status">
          ✅ Server is Running 
          <span class="environment">${NODE_ENV.toUpperCase()}</span>
        </div>
        <p style="font-size: 1.2em; margin-bottom: 30px; opacity: 0.9;">
          Learning Management System<br>
          Modern College of Arts, Science & Commerce, Warje Pune
        </p>
        <div>
          <a href="/login.html" class="btn">
            <i class="fas fa-sign-in-alt"></i> Go to Login
          </a>
          <a href="/api/health" class="btn secondary">
            <i class="fas fa-heartbeat"></i> API Health Check
          </a>
        </div>
        <div class="info">
          <p><strong>📊 System Information:</strong></p>
          <p>Port: ${PORT} | Environment: ${NODE_ENV}</p>
          <p>Base URL: ${BASE_URL}</p>
          <p style="margin-top: 10px; font-size: 12px;">
            © 2024 Modern College, Pune. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// ================= HEALTH CHECK ENDPOINT =================
app.get("/api/health", async (req, res) => {
  try {
    let dbStatus = "disconnected";
    let dbTime = null;
    
    try {
      const dbResult = await pool.query('SELECT NOW()');
      dbStatus = "connected";
      dbTime = dbResult.rows[0].now;
    } catch (dbErr) {
      dbStatus = "disconnected - " + dbErr.message;
    }
    
    res.json({
      success: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: NODE_ENV,
      server: "Modern College LMS",
      version: "1.0.0",
      database: dbStatus,
      database_time: dbTime,
      port: PORT,
      base_url: BASE_URL,
      endpoints: {
        login: "/api/login",
        teachers: "/api/teachers",
        students: "/api/students",
        classes: "/api/classes",
        health: "/api/health"
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      status: "error",
      message: "Health check failed",
      error: err.message
    });
  }
});

// ================= SIMPLE TEST LOGIN (Works without DB) =================
app.post("/api/test-login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }
    
    console.log(`🔐 Test login attempt for: ${email}`);
    
    // Test credentials for development
    const testUsers = {
      'admin@moderncollege.edu': { 
        name: 'Admin User', 
        userType: 'admin',
        password: 'admin123' 
      },
      'teacher@moderncollege.edu': { 
        name: 'Teacher User', 
        userType: 'teacher',
        password: 'teacher123' 
      },
      'student@moderncollege.edu': { 
        name: 'Student User', 
        userType: 'student',
        password: 'student123' 
      }
    };
    
    const user = testUsers[email];
    
    if (user && password === user.password) {
      const token = jwt.sign(
        { 
          email: email,
          name: user.name,
          userType: user.userType,
          id: 1 
        },
        JWT_SECRET,
        { expiresIn: "24h" }
      );
      
      return res.json({
        success: true,
        message: "Login successful",
        token: token,
        user: {
          email: email,
          name: user.name,
          userType: user.userType,
          id: 1
        },
        redirectTo: user.userType === 'admin' ? 'admin.html' : 
                    user.userType === 'teacher' ? 'teacher.html' : 
                    'student.html'
      });
    }
    
    return res.status(401).json({
      success: false,
      message: "Invalid credentials. Use test credentials."
    });
    
  } catch (err) {
    console.error("Test login error:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// ================= UNIFIED LOGIN ENDPOINT =================
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: "Email and password are required" 
      });
    }

    console.log(`🔐 Login attempt for: ${email}`);

    // Try database login first
    try {
      // Check admin table
      const adminResult = await pool.query(
        "SELECT * FROM admin WHERE email = $1",
        [email]
      );

      if (adminResult.rows.length > 0) {
        const admin = adminResult.rows[0];
        
        // Check if password is set
        if (!admin.password || admin.password.trim() === '') {
          return res.status(401).json({ 
            success: false,
            message: "No password set. Please use 'Forgot Password' first." 
          });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, admin.password);
        
        if (!isMatch) {
          return res.status(401).json({ 
            success: false,
            message: "Invalid credentials" 
          });
        }

        const token = jwt.sign(
          { 
            id: admin.id, 
            email: admin.email,
            userType: 'admin',
            name: admin.name || "Admin"
          },
          JWT_SECRET,
          { expiresIn: "24h" }
        );

        return res.json({
          success: true,
          message: "Login successful",
          token: token,
          user: {
            id: admin.id,
            email: admin.email,
            name: admin.name || "Admin",
            userType: 'admin'
          },
          redirectTo: "admin.html"
        });
      }

      // Check teachers table
      const teacherResult = await pool.query(
        "SELECT * FROM teachers WHERE email = $1",
        [email]
      );

      if (teacherResult.rows.length > 0) {
        const teacher = teacherResult.rows[0];
        
        if (!teacher.password || teacher.password.trim() === '') {
          return res.status(401).json({ 
            success: false,
            message: "No password set. Please use 'Forgot Password' first." 
          });
        }

        const isMatch = await bcrypt.compare(password, teacher.password);
        
        if (!isMatch) {
          return res.status(401).json({ 
            success: false,
            message: "Invalid credentials" 
          });
        }

        const token = jwt.sign(
          { 
            id: teacher.id, 
            email: teacher.email,
            userType: 'teacher',
            name: teacher.name || "Teacher"
          },
          JWT_SECRET,
          { expiresIn: "24h" }
        );

        return res.json({
          success: true,
          message: "Login successful",
          token: token,
          user: {
            id: teacher.id,
            email: teacher.email,
            name: teacher.name || "Teacher",
            teacher_code: teacher.teacher_code,
            department: teacher.department,
            userType: 'teacher'
          },
          redirectTo: "teacher.html"
        });
      }

      // Check students table
      const studentResult = await pool.query(
        "SELECT * FROM students WHERE email = $1",
        [email]
      );

      if (studentResult.rows.length > 0) {
        const student = studentResult.rows[0];
        
        if (!student.password || student.password.trim() === '') {
          return res.status(401).json({ 
            success: false,
            message: "No password set. Please use 'Forgot Password' first." 
          });
        }

        const isMatch = await bcrypt.compare(password, student.password);
        
        if (!isMatch) {
          return res.status(401).json({ 
            success: false,
            message: "Invalid credentials" 
          });
        }

        const token = jwt.sign(
          { 
            id: student.id, 
            email: student.email,
            userType: 'student',
            name: student.name || "Student"
          },
          JWT_SECRET,
          { expiresIn: "24h" }
        );

        return res.json({
          success: true,
          message: "Login successful",
          token: token,
          user: {
            id: student.id,
            email: student.email,
            name: student.name || "Student",
            student_code: student.student_code,
            roll_no: student.roll_no,
            department: student.department,
            faculty: student.faculty,
            stream: student.stream,
            userType: 'student'
          },
          redirectTo: "student.html"
        });
      }

      // No user found in database
      return res.status(401).json({ 
        success: false,
        message: "Invalid credentials" 
      });

    } catch (dbError) {
      console.log("⚠️ Database login failed, falling back to test login:", dbError.message);
      
      // Fall back to test login if database fails
      const testUsers = {
        'admin@moderncollege.edu': { 
          name: 'Admin User', 
          userType: 'admin',
          password: 'admin123' 
        },
        'teacher@moderncollege.edu': { 
          name: 'Teacher User', 
          userType: 'teacher',
          password: 'teacher123' 
        },
        'student@moderncollege.edu': { 
          name: 'Student User', 
          userType: 'student',
          password: 'student123' 
        }
      };
      
      const user = testUsers[email];
      
      if (user && password === user.password) {
        const token = jwt.sign(
          { 
            email: email,
            name: user.name,
            userType: user.userType,
            id: 1 
          },
          JWT_SECRET,
          { expiresIn: "24h" }
        );
        
        return res.json({
          success: true,
          message: "Login successful (Test Mode)",
          token: token,
          user: {
            email: email,
            name: user.name,
            userType: user.userType,
            id: 1
          },
          redirectTo: user.userType === 'admin' ? 'admin.html' : 
                      user.userType === 'teacher' ? 'teacher.html' : 
                      'student.html'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error: " + err.message 
    });
  }
});

// ================= FORGOT PASSWORD =================
app.post("/api/forgot-password", async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: "Email or ID is required"
      });
    }

    console.log(`📧 Forgot password request for: ${identifier}`);

    // Try to send email
    try {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      
      const resetLink = `${BASE_URL}/reset.html?token=${resetToken}`;
      
      await transporter.sendMail({
        from: '"Modern College LMS" <lms987565@gmail.com>',
        to: identifier.includes('@') ? identifier : 'user@example.com',
        subject: "🔐 Reset Your Password - Modern College LMS",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #0d47a1 0%, #1565c0 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h2>Modern College LMS</h2>
              <p>Password Reset Request</p>
            </div>
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
              <h3>Dear User,</h3>
              <p>You requested a password reset for your Modern College LMS account.</p>
              <p><strong>Click the button below to reset your password:</strong></p>
              <a href="${resetLink}" style="display: inline-block; background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0;">Reset Password</a>
              
              <p><strong>Note:</strong> This link will expire in <strong>30 minutes</strong>.</p>
              <p>If you didn't request this, please ignore this email.</p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #777;">
                <p>Modern College of Arts, Science and Commerce</p>
                <p>Warje, Pune - 411058 | www.moderncollege.edu</p>
              </div>
            </div>
          </div>
        `
      });
      
      console.log(`✅ Reset email sent to: ${identifier}`);
      
      res.json({ 
        success: true,
        message: "Password reset link sent successfully" 
      });
      
    } catch (emailError) {
      console.log("⚠️ Email sending failed:", emailError.message);
      
      // Return success even if email fails (for development)
      res.json({ 
        success: true,
        message: "Password reset would be sent in production",
        note: "SMTP not configured or email sending failed"
      });
    }

  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ 
      success: false,
      message: "Server error" 
    });
  }
});

// ================= PROTECTED ROUTE TEST =================
app.get("/api/protected", authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: "Token is valid",
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

// ================= SERVE ALL HTML FILES =================
app.get("/*.html", (req, res) => {
  const fileName = req.path.substring(1); // Remove leading slash
  res.sendFile(path.join(__dirname, "public", fileName), (err) => {
    if (err) {
      res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Page Not Found</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #ff4444; }
            a { color: #1a237e; text-decoration: none; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>404 - Page Not Found</h1>
          <p>The page "${fileName}" was not found.</p>
          <a href="/">← Return to Home</a>
        </body>
        </html>
      `);
    }
  });
});

// ================= 404 HANDLER =================
app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>404 Not Found</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          text-align: center; 
          padding: 50px;
          background: linear-gradient(135deg, #f5f5f5 0%, #e0e0e0 100%);
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 15px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          display: inline-block;
        }
        h1 { 
          color: #ff4444; 
          font-size: 3em;
          margin-bottom: 10px;
        }
        p { 
          color: #666;
          margin-bottom: 30px;
          font-size: 1.2em;
        }
        .btn {
          display: inline-block;
          padding: 12px 30px;
          background: #1a237e;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: bold;
          transition: all 0.3s;
        }
        .btn:hover {
          background: #283593;
          transform: translateY(-2px);
        }
        .error-code {
          font-size: 120px;
          color: #1a237e;
          opacity: 0.1;
          font-weight: bold;
          margin: 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="error-code">404</div>
        <h1>Page Not Found</h1>
        <p>The page you are looking for does not exist.</p>
        <a href="/" class="btn">← Return to Home</a>
      </div>
    </body>
    </html>
  `);
});

// ================= ERROR HANDLER =================
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err);
  
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      message: "CORS Error: Request blocked",
      detail: "Your origin is not allowed. Contact administrator."
    });
  }
  
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: NODE_ENV === "development" ? err.message : undefined
  });
});

// ================= START SERVER =================
async function startServer() {
  // Test database connection
  await testDatabaseConnection();
  
  // Start the server
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ╔══════════════════════════════════════════════════════════╗
    ║                🚀 MODERN COLLEGE LMS                    ║
    ╠══════════════════════════════════════════════════════════╣
    ║   📍 Server URL: ${BASE_URL.padEnd(40)} ║
    ║   🔧 Environment: ${NODE_ENV.padEnd(38)} ║
    ║   🚪 Port: ${String(PORT).padEnd(43)} ║
    ║   📁 Public Files: ${path.join(__dirname, "public").padEnd(33)} ║
    ╚══════════════════════════════════════════════════════════╝
    `);
    console.log(`✅ Server started successfully!`);
    console.log(`👉 Visit: ${BASE_URL}`);
    console.log(`👉 API Health: ${BASE_URL}/api/health`);
    console.log(`👉 Login Page: ${BASE_URL}/login.html`);
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('🛑 SIGINT received. Shutting down gracefully...');
    server.close(() => {
      console.log('✅ Server closed');
      process.exit(0);
    });
  });
}

// Export the app for testing
module.exports = app;

// Start the server if this file is run directly
if (require.main === module) {
  startServer().catch(err => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  });
}