// ============================================
// Modern College LMS - Main Server File
// ============================================

// Import required modules
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8080;
const ENVIRONMENT = process.env.NODE_ENV || 'development';

// ============================================
// Configuration & Middleware
// ============================================

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Adjust based on your needs
}));

// CORS configuration
const corsOptions = {
  origin: ENVIRONMENT === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || []
    : '*',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Logging middleware
if (ENVIRONMENT === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files middleware
const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath, {
    maxAge: ENVIRONMENT === 'production' ? '1y' : '0',
    index: false,
    extensions: ['html', 'htm']
  }));
}

// ============================================
// Database Connection (Example - Adjust based on your DB)
// ============================================

let dbConnection = null;

const connectToDatabase = async () => {
  try {
    // Example with SQLite (adjust for your database)
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database('./database/lms.db', (err) => {
      if (err) {
        console.error('❌ Database connection error:', err.message);
        dbConnection = null;
      } else {
        console.log('✅ Connected to SQLite database');
        dbConnection = db;
        
        // Create tables if they don't exist
        initializeDatabase();
      }
    });
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    dbConnection = null;
  }
};

const initializeDatabase = () => {
  if (!dbConnection) return;
  
  const createTables = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'student',
      full_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_code TEXT UNIQUE NOT NULL,
      course_name TEXT NOT NULL,
      description TEXT,
      instructor_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (instructor_id) REFERENCES users(id)
    );
    
    CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id),
      FOREIGN KEY (course_id) REFERENCES courses(id),
      UNIQUE(student_id, course_id)
    );
  `;
  
  dbConnection.exec(createTables, (err) => {
    if (err) {
      console.error('❌ Error creating tables:', err.message);
    } else {
      console.log('✅ Database tables ready');
    }
  });
};

// ============================================
// Authentication & Session Management
// ============================================

const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: './database'
  }),
  secret: process.env.SESSION_SECRET || 'modern-college-lms-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    secure: ENVIRONMENT === 'production',
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
      redirect: '/login'
    });
  }
};

const isAdmin = (req, res, next) => {
  if (req.session && req.session.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
};

const isInstructor = (req, res, next) => {
  if (req.session && (req.session.role === 'instructor' || req.session.role === 'admin')) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Instructor access required'
    });
  }
};

// ============================================
// API Routes
// ============================================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: ENVIRONMENT,
    database: dbConnection ? 'connected' : 'disconnected'
  });
});

// User registration
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, full_name, role = 'student' } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required'
      });
    }
    
    // Hash password (in production, use bcrypt)
    const hashedPassword = Buffer.from(password).toString('base64'); // Simple encoding - use bcrypt in production
    
    const query = 'INSERT INTO users (username, email, password, full_name, role) VALUES (?, ?, ?, ?, ?)';
    
    dbConnection.run(query, [username, email, hashedPassword, full_name, role], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({
            success: false,
            message: 'Username or email already exists'
          });
        }
        throw err;
      }
      
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        userId: this.lastID
      });
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
});

// User login
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }
    
    const hashedPassword = Buffer.from(password).toString('base64');
    const query = 'SELECT id, username, email, role, full_name FROM users WHERE username = ? AND password = ?';
    
    dbConnection.get(query, [username, hashedPassword], (err, user) => {
      if (err) {
        throw err;
      }
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid username or password'
        });
      }
      
      // Set session
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      req.session.email = user.email;
      
      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          full_name: user.full_name
        }
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
});

// User logout
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({
        success: false,
        message: 'Error during logout'
      });
    }
    
    res.json({
      success: true,
      message: 'Logout successful'
    });
  });
});

// Get current user
app.get('/api/user/me', isAuthenticated, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.session.userId,
      username: req.session.username,
      email: req.session.email,
      role: req.session.role
    }
  });
});

// Course management
app.get('/api/courses', (req, res) => {
  try {
    const query = `
      SELECT c.*, u.full_name as instructor_name 
      FROM courses c 
      LEFT JOIN users u ON c.instructor_id = u.id 
      ORDER BY c.created_at DESC
    `;
    
    dbConnection.all(query, [], (err, courses) => {
      if (err) throw err;
      
      res.json({
        success: true,
        courses: courses || []
      });
    });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching courses'
    });
  }
});

app.post('/api/courses', isInstructor, (req, res) => {
  try {
    const { course_code, course_name, description } = req.body;
    
    if (!course_code || !course_name) {
      return res.status(400).json({
        success: false,
        message: 'Course code and name are required'
      });
    }
    
    const query = 'INSERT INTO courses (course_code, course_name, description, instructor_id) VALUES (?, ?, ?, ?)';
    
    dbConnection.run(query, [course_code, course_name, description, req.session.userId], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({
            success: false,
            message: 'Course code already exists'
          });
        }
        throw err;
      }
      
      res.status(201).json({
        success: true,
        message: 'Course created successfully',
        courseId: this.lastID
      });
    });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating course'
    });
  }
});

// Enrollment
app.post('/api/enroll/:courseId', isAuthenticated, (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId);
    const studentId = req.session.userId;
    
    if (!courseId || isNaN(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid course ID is required'
      });
    }
    
    const query = 'INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)';
    
    dbConnection.run(query, [studentId, courseId], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({
            success: false,
            message: 'Already enrolled in this course'
          });
        }
        throw err;
      }
      
      res.json({
        success: true,
        message: 'Enrolled successfully',
        enrollmentId: this.lastID
      });
    });
  } catch (error) {
    console.error('Enrollment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error enrolling in course'
    });
  }
});

// ============================================
// Static HTML Routes (FIXED - No path-to-regexp errors)
// ============================================

// Serve main pages
const servePage = (pageName) => {
  return (req, res) => {
    const filePath = path.join(__dirname, 'views', `${pageName}.html`);
    
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({
        success: false,
        message: `Page ${pageName} not found`
      });
    }
  };
};

// Define specific routes for HTML pages
app.get('/', servePage('index'));
app.get('/login', servePage('login'));
app.get('/register', servePage('register'));
app.get('/dashboard', isAuthenticated, servePage('dashboard'));
app.get('/courses', isAuthenticated, servePage('courses'));
app.get('/profile', isAuthenticated, servePage('profile'));
app.get('/admin', isAdmin, servePage('admin'));

// Catch-all route for SPA or 404
app.get('*', (req, res) => {
  // Check if it's an API request
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: 'API endpoint not found'
    });
  }
  
  // For HTML requests, serve 404 page or redirect
  const filePath = path.join(__dirname, 'views', '404.html');
  
  if (fs.existsSync(filePath)) {
    res.status(404).sendFile(filePath);
  } else {
    res.status(404).json({
      success: false,
      message: 'Page not found',
      requestedPath: req.path
    });
  }
});

// ============================================
// Error Handling Middleware
// ============================================

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('🚨 Global error handler:', err);
  
  const statusCode = err.status || 500;
  const message = ENVIRONMENT === 'production' 
    ? 'Internal server error' 
    : err.message || 'Internal server error';
  
  res.status(statusCode).json({
    success: false,
    message: message,
    ...(ENVIRONMENT === 'development' && { stack: err.stack })
  });
});

// ============================================
// Server Startup
// ============================================

const startServer = () => {
  // Connect to database first
  connectToDatabase();
  
  // Start server
  const server = app.listen(PORT, () => {
    console.log('\n' + '='.repeat(50));
    console.log('🚀 Modern College LMS Starting...');
    console.log('🌍 Environment:', ENVIRONMENT);
    console.log('📍 Port:', PORT);
    console.log('🔗 Base URL:', `http://localhost:${PORT}`);
    console.log('📁 Public directory:', publicPath);
    console.log('✅ Server is running successfully!');
    console.log('='.repeat(50) + '\n');
  });
  
  // Graceful shutdown
  const gracefulShutdown = () => {
    console.log('\n🛑 Received shutdown signal...');
    
    server.close(() => {
      console.log('✅ HTTP server closed');
      
      // Close database connection
      if (dbConnection) {
        dbConnection.close((err) => {
          if (err) {
            console.error('❌ Error closing database:', err.message);
          } else {
            console.log('✅ Database connection closed');
          }
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    });
    
    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('⏰ Forcing shutdown after timeout');
      process.exit(1);
    }, 10000);
  };
  
  // Handle shutdown signals
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error);
    gracefulShutdown();
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  });
  
  return server;
};

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
