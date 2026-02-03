const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Modern College LMS is running',
    timestamp: new Date().toISOString()
  });
});

// Serve main page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Modern College LMS</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 50px;
          background: #f5f5f5;
        }
        h1 { color: #1a237e; }
        .status {
          background: #4CAF50;
          color: white;
          padding: 10px;
          border-radius: 5px;
          margin: 20px;
        }
      </style>
    </head>
    <body>
      <h1>🎓 Modern College LMS</h1>
      <div class="status">✅ Server is Running</div>
      <p>Learning Management System</p>
      <a href="/login.html">Go to Login</a>
    </body>
    </html>
  `);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Serving static files from: ${path.join(__dirname, 'public')}`);
});

const JWT_SECRET = "mysecretkey"; // move to .env later

// ================= SMTP CONFIG =================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "lms987565@gmail.com",
    pass: "mszc glaz lxdg aoti"
  }
});

// Test email connection on startup
transporter.verify(function(error, success) {
  if (error) {
    console.log("❌ SMTP Connection Error:", error);
  } else {
    console.log("✅ SMTP Server is ready to send emails");
  }
});

// ================= FIX: Handle all HTML file routes =================
// Serve login.html specifically
app.get("/login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Serve other HTML pages
app.get("/reset.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "reset.html"));
});

app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/teacher.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "teacher.html"));
});

app.get("/student.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "student.html"));
});

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

// ================= CLASS CODE GENERATOR =================
function generateClassCode(row) {
  const dept = row.department ? row.department.trim().substring(0, 3).toUpperCase().replace(/\s/g, '') : 'GEN';
  const stream = row.stream ? row.stream.trim().substring(0, 3).toUpperCase().replace(/\s/g, '') : 'GEN';
  const division = row.division ? row.division.trim().toUpperCase() : 'X';
  const semester = row.semester ? row.semester.toString().padStart(2, '0') : '00';
  
  // Extract year code (e.g., 2025-26 -> 2526)
  let yearCode = '2526';
  if (row.academic_year) {
    const years = row.academic_year.match(/\d{4}|\d{2}/g);
    if (years) {
      if (years.length === 2) {
        // Format: 2025-2026 or 2025-26
        yearCode = years[0].substring(2) + years[1].substring(2);
      } else if (years.length === 1) {
        // Format: 2025
        yearCode = years[0].substring(2) + (parseInt(years[0].substring(2)) + 1).toString();
      }
    }
  }
  
  return `${dept}-${stream}-${division}-SEM${semester}-${yearCode}`;
}

// ================= JWT MIDDLEWARE =================
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
}

// ================= DATABASE SCHEMA CREATION =================
app.get("/api/create-schema", async (req, res) => {
  try {
    // Create classes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        class_code VARCHAR(50) UNIQUE NOT NULL,
        class_name VARCHAR(100) NOT NULL,
        department VARCHAR(100),
        stream VARCHAR(100),
        division VARCHAR(10),
        semester INTEGER,
        academic_year VARCHAR(20),
        faculty VARCHAR(100),
        subjects TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    // Create class_students table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS class_students (
        id SERIAL PRIMARY KEY,
        class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        student_code VARCHAR(50),
        enrolled_subjects TEXT,
        enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(class_id, student_id)
      )
    `);

    // Create class_teachers table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS class_teachers (
        id SERIAL PRIMARY KEY,
        class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
        teacher_id INTEGER REFERENCES teachers(id) ON DELETE CASCADE,
        subjects TEXT,
        assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_primary BOOLEAN DEFAULT FALSE,
        UNIQUE(class_id, teacher_id, subjects)
      )
    `);

    // Create announcements table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
        teacher_id INTEGER REFERENCES teachers(id),
        title VARCHAR(200) NOT NULL,
        content TEXT,
        announcement_type VARCHAR(50) DEFAULT 'general',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create study_materials table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS study_materials (
        id SERIAL PRIMARY KEY,
        class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
        teacher_id INTEGER REFERENCES teachers(id),
        subject VARCHAR(100),
        title VARCHAR(200) NOT NULL,
        description TEXT,
        material_type VARCHAR(50),
        file_url TEXT,
        file_name VARCHAR(255),
        file_size INTEGER,
        youtube_link TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create subject_enrollments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subject_enrollments (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
        class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
        subject VARCHAR(100) NOT NULL,
        enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, class_id, subject)
      )
    `);

    // Create indexes
    await pool.query("CREATE INDEX IF NOT EXISTS idx_class_students_class_id ON class_students(class_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_class_students_student_id ON class_students(student_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_class_teachers_class_id ON class_teachers(class_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_announcements_class_id ON announcements(class_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_study_materials_class_id ON study_materials(class_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_subject_enrollments_student_id ON subject_enrollments(student_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_classes_department_stream ON classes(department, stream, division, semester)");

    res.json({ success: true, message: "Class schema created successfully" });
  } catch (err) {
    console.error("❌ Error creating schema:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================= UNIFIED LOGIN =================
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

    // Try admin table first
    let user = null;
    let userType = '';

    // Check admin table
    const adminResult = await pool.query(
      "SELECT * FROM admin WHERE email = $1",
      [email]
    );

    if (adminResult.rows.length > 0) {
      user = adminResult.rows[0];
      userType = 'admin';
    } else {
      // Check teachers table
      const teacherResult = await pool.query(
        "SELECT * FROM teachers WHERE email = $1",
        [email]
      );

      if (teacherResult.rows.length > 0) {
        user = teacherResult.rows[0];
        userType = 'teacher';
      } else {
        // Check students table
        const studentResult = await pool.query(
          "SELECT * FROM students WHERE email = $1",
          [email]
        );

        if (studentResult.rows.length > 0) {
          user = studentResult.rows[0];
          userType = 'student';
        }
      }
    }

    // If no user found
    if (!user) {
      console.log(`❌ No user found with email: ${email}`);
      return res.status(401).json({ 
        success: false,
        message: "Invalid credentials" 
      });
    }

    // Check if password is set
    if (!user.password || user.password.trim() === '') {
      console.log(`⚠️ ${userType} ${email} has no password set`);
      return res.status(401).json({ 
        success: false,
        message: "No password set. Please use 'Forgot Password' to set your password first." 
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      console.log(`❌ Password incorrect for: ${email}`);
      return res.status(401).json({ 
        success: false,
        message: "Invalid credentials" 
      });
    }

    console.log(`✅ Password verified for ${email} (${userType})`);
    
    // Create JWT payload based on user type
    let payload = {};
    let userData = {};

    if (userType === 'admin') {
      payload = {
        id: user.id,
        email: user.email,
        userType: 'admin',
        name: user.name || "Admin"
      };
      userData = {
        id: user.id,
        email: user.email,
        name: user.name || "Admin",
        userType: 'admin'
      };
    } else if (userType === 'teacher') {
      payload = {
        id: user.id,
        email: user.email,
        userType: 'teacher',
        name: user.name || "Teacher"
      };
      userData = {
        id: user.id,
        email: user.email,
        name: user.name || "Teacher",
        teacher_code: user.teacher_code,
        department: user.department,
        userType: 'teacher'
      };
    } else if (userType === 'student') {
      payload = {
        id: user.id,
        email: user.email,
        userType: 'student',
        name: user.name || "Student"
      };
      userData = {
        id: user.id,
        email: user.email,
        name: user.name || "Student",
        student_code: user.student_code,
        roll_no: user.roll_no,
        department: user.department,
        faculty: user.faculty,
        stream: user.stream,
        userType: 'student'
      };
    }

    // Generate JWT token
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });

    console.log(`✅ JWT token generated for ${email} (${userType})`);

    // Return appropriate response
    res.json({
      success: true,
      message: "Login successful",
      token: token,
      user: userData,
      redirectTo: userType === 'admin' ? 'admin.html' : 
                  userType === 'teacher' ? 'teacher.html' : 
                  'student.html'
    });

  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error: " + err.message 
    });
  }
});

// ================= 🔐 PROTECTED ROUTE =================
app.get("/api/protected", authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: "Token is valid",
    user: req.user
  });
});

// ================= TEACHERS MANAGEMENT ENDPOINTS =================

// GET all teachers (PROTECTED)
app.get("/api/teachers", authenticateToken, async (req, res) => {
  try {
    console.log("📥 Fetching all teachers");
    const result = await pool.query(
      `SELECT id, teacher_code, name, email, department, subjects, mobile, faculty
       FROM teachers
       ORDER BY id`
    );
    
    console.log(`✅ Found ${result.rows.length} teachers`);
    
    res.json({
      success: true,
      teachers: result.rows
    });
  } catch (err) {
    console.error("❌ Error fetching teachers:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch teachers: " + err.message 
    });
  }
});

// GET unique departments (PROTECTED)
app.get("/api/departments", authenticateToken, async (req, res) => {
  try {
    console.log("📥 Fetching departments");
    const result = await pool.query(
      `SELECT DISTINCT department 
       FROM teachers 
       WHERE department IS NOT NULL 
       ORDER BY department`
    );
    
    const departments = result.rows.map(row => row.department);
    console.log(`✅ Found ${departments.length} departments`);
    
    res.json({
      success: true,
      departments: departments
    });
  } catch (err) {
    console.error("❌ Error fetching departments:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch departments: " + err.message 
    });
  }
});

// ================= GET TEACHER SUBJECTS =================
app.get("/api/teacher-subjects", authenticateToken, async (req, res) => {
  try {
    console.log("📥 Fetching teacher subjects for:", req.user.email);
    
    // Get teacher ID from token
    const teacherResult = await pool.query(
      "SELECT id FROM teachers WHERE email = $1",
      [req.user.email]
    );
    
    if (teacherResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Teacher not found" 
      });
    }
    
    const teacherId = teacherResult.rows[0].id;
    
    // Get all subjects taught by this teacher across all classes
    const result = await pool.query(
      `SELECT DISTINCT ct.subjects
       FROM class_teachers ct
       WHERE ct.teacher_id = $1
       AND ct.subjects IS NOT NULL
       AND ct.subjects != ''`,
      [teacherId]
    );
    
    // Extract and combine all subjects
    let allSubjects = new Set();
    result.rows.forEach(row => {
      if (row.subjects) {
        const subjects = row.subjects.split(',').map(s => s.trim());
        subjects.forEach(subject => {
          if (subject) allSubjects.add(subject);
        });
      }
    });
    
    // Get teacher's personal subjects from teachers table
    const teacherData = await pool.query(
      "SELECT subjects FROM teachers WHERE id = $1",
      [teacherId]
    );
    
    if (teacherData.rows[0]?.subjects) {
      const personalSubjects = teacherData.rows[0].subjects.split(',').map(s => s.trim());
      personalSubjects.forEach(subject => {
        if (subject) allSubjects.add(subject);
      });
    }
    
    const subjectsArray = Array.from(allSubjects).sort();
    
    console.log(`✅ Found ${subjectsArray.length} subjects for teacher`);
    
    res.json({
      success: true,
      subjects: subjectsArray
    });
    
  } catch (err) {
    console.error("❌ Error fetching teacher subjects:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch teacher subjects: " + err.message 
    });
  }
});

// ================= GET TEACHER'S SUBJECTS BY ID =================
app.get("/api/teachers/:id/subjects", authenticateToken, async (req, res) => {
  try {
    const teacherId = req.params.id;
    console.log(`📥 Fetching subjects for teacher ID: ${teacherId}`);
    
    // Get teacher's personal subjects
    const teacherResult = await pool.query(
      "SELECT subjects FROM teachers WHERE id = $1",
      [teacherId]
    );
    
    if (teacherResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Teacher not found" 
      });
    }
    
    // Get subjects from class assignments
    const classSubjectsResult = await pool.query(
      `SELECT subjects FROM class_teachers WHERE teacher_id = $1 AND subjects IS NOT NULL`,
      [teacherId]
    );
    
    // Combine all subjects
    let allSubjects = new Set();
    
    // Add teacher's personal subjects
    if (teacherResult.rows[0].subjects) {
      const teacherSubjects = teacherResult.rows[0].subjects.split(',').map(s => s.trim());
      teacherSubjects.forEach(subject => {
        if (subject && subject !== '') {
          allSubjects.add(subject);
        }
      });
    }
    
    // Add subjects from class assignments
    classSubjectsResult.rows.forEach(row => {
      if (row.subjects) {
        const classSubjects = row.subjects.split(',').map(s => s.trim());
        classSubjects.forEach(subject => {
          if (subject && subject !== '') {
            allSubjects.add(subject);
          }
        });
      }
    });
    
    const subjectsArray = Array.from(allSubjects).sort();
    
    console.log(`✅ Found ${subjectsArray.length} subjects for teacher ${teacherId}`);
    
    res.json({
      success: true,
      subjects: subjectsArray
    });
    
  } catch (err) {
    console.error("❌ Error fetching teacher subjects:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch teacher subjects: " + err.message 
    });
  }
});

// ================= GET ALL AVAILABLE SUBJECTS =================
app.get("/api/subjects", authenticateToken, async (req, res) => {
  try {
    console.log("📥 Fetching all available subjects");
    
    // Get unique subjects from teachers
    const teachersResult = await pool.query(
      `SELECT DISTINCT UNNEST(string_to_array(subjects, ',')) as subject
       FROM teachers 
       WHERE subjects IS NOT NULL AND subjects != ''`
    );
    
    // Get unique subjects from class_teachers
    const classTeachersResult = await pool.query(
      `SELECT DISTINCT UNNEST(string_to_array(subjects, ',')) as subject
       FROM class_teachers 
       WHERE subjects IS NOT NULL AND subjects != ''`
    );
    
    // Get unique subjects from classes
    const classesResult = await pool.query(
      `SELECT DISTINCT UNNEST(string_to_array(subjects, ',')) as subject
       FROM classes 
       WHERE subjects IS NOT NULL AND subjects != ''`
    );
    
    // Combine all subjects
    let allSubjects = new Set();
    
    [teachersResult.rows, classTeachersResult.rows, classesResult.rows].forEach(resultSet => {
      resultSet.forEach(row => {
        if (row.subject && row.subject.trim() !== '') {
          allSubjects.add(row.subject.trim());
        }
      });
    });
    
    const subjectsArray = Array.from(allSubjects).sort();
    
    console.log(`✅ Found ${subjectsArray.length} unique subjects`);
    
    res.json({
      success: true,
      subjects: subjectsArray
    });
    
  } catch (err) {
    console.error("❌ Error fetching all subjects:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch subjects: " + err.message 
    });
  }
});

// ================= GET TEACHER'S PROFILE WITH SUBJECTS =================
app.get("/api/teachers/:id", authenticateToken, async (req, res) => {
  try {
    const teacherId = req.params.id;
    console.log(`📥 Fetching teacher details for ID: ${teacherId}`);
    
    // Get basic teacher info
    const teacherResult = await pool.query(
      `SELECT id, teacher_code, name, email, department, subjects, mobile, faculty
       FROM teachers 
       WHERE id = $1`,
      [teacherId]
    );
    
    if (teacherResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Teacher not found" 
      });
    }
    
    const teacher = teacherResult.rows[0];
    
    // Get teacher's class assignments
    const assignmentsResult = await pool.query(
      `SELECT c.id as class_id, c.class_name, c.class_code, ct.subjects, ct.is_primary
       FROM class_teachers ct
       JOIN classes c ON ct.class_id = c.id
       WHERE ct.teacher_id = $1
       ORDER BY c.class_name`,
      [teacherId]
    );
    
    // Combine all subjects from teacher profile and assignments
    let allSubjects = new Set();
    
    // Add teacher's personal subjects
    if (teacher.subjects) {
      const teacherSubjects = teacher.subjects.split(',').map(s => s.trim());
      teacherSubjects.forEach(subject => {
        if (subject && subject !== '') {
          allSubjects.add(subject);
        }
      });
    }
    
    // Add subjects from assignments
    assignmentsResult.rows.forEach(assignment => {
      if (assignment.subjects) {
        const assignmentSubjects = assignment.subjects.split(',').map(s => s.trim());
        assignmentSubjects.forEach(subject => {
          if (subject && subject !== '') {
            allSubjects.add(subject);
          }
        });
      }
    });
    
    const subjectsArray = Array.from(allSubjects).sort();
    
    res.json({
      success: true,
      teacher: {
        ...teacher,
        all_subjects: subjectsArray
      },
      assignments: assignmentsResult.rows
    });
    
  } catch (err) {
    console.error("❌ Error fetching teacher details:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch teacher details: " + err.message 
    });
  }
});

// ================= GET ALL TEACHER SUBJECTS =================
app.get("/api/all-teacher-subjects", authenticateToken, async (req, res) => {
  try {
    console.log("📥 Fetching all teacher subjects");
    
    // Get all unique subjects from teachers table
    const result = await pool.query(
      `SELECT DISTINCT UNNEST(string_to_array(subjects, ',')) as subject
       FROM teachers
       WHERE subjects IS NOT NULL AND subjects != ''
       UNION
       SELECT DISTINCT UNNEST(string_to_array(subjects, ',')) as subject
       FROM class_teachers
       WHERE subjects IS NOT NULL AND subjects != ''
       ORDER BY subject`
    );
    
    const subjects = result.rows.map(row => row.subject).filter(subject => subject && subject.trim() !== '');
    
    console.log(`✅ Found ${subjects.length} unique subjects`);
    
    res.json({
      success: true,
      subjects: subjects
    });
    
  } catch (err) {
    console.error("❌ Error fetching all teacher subjects:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch teacher subjects: " + err.message 
    });
  }
});

// ================= TEACHER CSV UPLOAD =================
app.post("/api/upload-teachers", authenticateToken, async (req, res) => {
  console.log("📥 Received CSV upload request");
  
  if (!req.body || !Array.isArray(req.body)) {
    console.error("❌ Invalid request body. Expected array of teachers.");
    return res.status(400).json({ 
      success: false,
      error: "Invalid request format. Expected array of teachers." 
    });
  }

  const teachers = req.body;
  console.log(`📊 Processing ${teachers.length} teacher records`);

  try {
    let inserted = 0;
    let updated = 0;
    let emailsSent = 0;
    let errors = [];

    for (let i = 0; i < teachers.length; i++) {
      const row = teachers[i];
      
      console.log(`\n--- Processing row ${i + 1} ---`);

      // Skip if row is empty
      if (!row || Object.keys(row).length === 0) {
        console.log("Skipping empty row");
        continue;
      }

      // Validate required fields
      if (!row.teacher_code || !row.teacher_code.trim()) {
        const errorMsg = `Row ${i + 1}: Missing teacher_code`;
        console.error("❌", errorMsg);
        errors.push(errorMsg);
        continue;
      }
      
      if (!row.name || !row.name.trim()) {
        const errorMsg = `Row ${i + 1}: Missing name`;
        console.error("❌", errorMsg);
        errors.push(errorMsg);
        continue;
      }
      
      if (!row.email || !row.email.trim()) {
        const errorMsg = `Row ${i + 1}: Missing email`;
        console.error("❌", errorMsg);
        errors.push(errorMsg);
        continue;
      }

      // Trim all fields
      const teacherCode = row.teacher_code.trim();
      const name = row.name.trim();
      const email = row.email.trim();
      const mobile = row.mobile ? row.mobile.trim() : null;
      const faculty = row.faculty ? row.faculty.trim() : null;
      const department = row.department ? row.department.trim() : null;

      // Normalize subjects
      let subjects = null;
      if (row.subjects && row.subjects.trim()) {
        subjects = row.subjects.split(",").map(s => s.trim()).join(",");
      }

      console.log("Processing:", { teacherCode, name, email });

      try {
        // Check if teacher already exists
        const existing = await pool.query(
          `SELECT id, password
           FROM teachers
           WHERE teacher_code = $1 OR email = $2`,
          [teacherCode, email]
        );

        console.log(`Existing records found: ${existing.rows.length}`);

        // Insert new teacher
        if (existing.rows.length === 0) {
          console.log(`Inserting new teacher: ${teacherCode} - ${name}`);

          await pool.query(
            `INSERT INTO teachers
             (teacher_code, name, email, mobile, faculty, department, subjects,
              last_reset_request)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [
              teacherCode,
              name,
              email,
              mobile,
              faculty,
              department,
              subjects
            ]
          );
          inserted++;
          console.log(`✅ Inserted new teacher: ${teacherCode} - ${name}`);

          // Send registration email
          try {
            await sendTeacherWelcomeEmail(name, email, teacherCode, mobile, department);
            emailsSent++;
            console.log(`📧 Welcome email sent to: ${email}`);
          } catch (emailError) {
            console.error(`❌ Failed to send email to ${email}:`, emailError.message);
            errors.push(`Row ${i + 1}: Teacher added but email failed to send`);
          }

        } else {
          // Update existing teacher
          const teacherId = existing.rows[0].id;
          console.log(`Updating existing teacher ID: ${teacherId}`);

          await pool.query(
            `UPDATE teachers SET
                name        = COALESCE($1, name),
                mobile      = COALESCE($2, mobile),
                faculty     = COALESCE($3, faculty),
                department  = COALESCE($4, department),
                subjects    = COALESCE($5, subjects)
             WHERE id = $6`,
            [
              name,
              mobile,
              faculty,
              department,
              subjects,
              teacherId
            ]
          );
          updated++;
          console.log(`🔄 Updated existing teacher: ${teacherCode} - ${name}`);
        }

      } catch (err) {
        console.error(`❌ Error processing row ${i + 1}:`, err.message);
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }

    console.log(`\n📊 Processing Summary:`);
    console.log(`Total rows: ${teachers.length}`);
    console.log(`Inserted: ${inserted}`);
    console.log(`Updated: ${updated}`);
    console.log(`Emails sent: ${emailsSent}`);
    console.log(`Errors: ${errors.length}`);
    
    res.json({
      success: true,
      message: `CSV processed successfully. ${inserted} inserted, ${updated} updated, ${emailsSent} emails sent.`,
      stats: {
        total: teachers.length,
        inserted: inserted,
        updated: updated,
        emailsSent: emailsSent,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    console.error("❌ Teacher CSV merge error:", err);
    res.status(500).json({ 
      success: false,
      error: "CSV merge failed: " + err.message 
    });
  }
});

// ================= GET TEACHER PROFILE =================
app.get("/api/teacher-profile", authenticateToken, async (req, res) => {
  try {
    console.log("📥 Fetching teacher profile for:", req.user.email);
    
    const result = await pool.query(
      `SELECT id, teacher_code, name, email, department, subjects,
              mobile, faculty
       FROM teachers 
       WHERE email = $1`,
      [req.user.email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Teacher not found" 
      });
    }

    const teacher = result.rows[0];
    
    // Get teacher's classes and subjects
    const classSubjectsResult = await pool.query(
      `SELECT c.class_name, ct.subjects
       FROM class_teachers ct
       JOIN classes c ON ct.class_id = c.id
       WHERE ct.teacher_id = $1
       ORDER BY c.class_name`,
      [teacher.id]
    );
    
    // Combine all subjects
    let allSubjects = new Set();
    if (teacher.subjects) {
      const teacherSubjects = teacher.subjects.split(',').map(s => s.trim());
      teacherSubjects.forEach(subject => {
        if (subject) allSubjects.add(subject);
      });
    }
    
    classSubjectsResult.rows.forEach(row => {
      if (row.subjects) {
        const classSubjects = row.subjects.split(',').map(s => s.trim());
        classSubjects.forEach(subject => {
          if (subject) allSubjects.add(subject);
        });
      }
    });
    
    const subjectsArray = Array.from(allSubjects).sort();
    
    res.json({
      success: true,
      teacher: {
        id: teacher.id,
        teacher_code: teacher.teacher_code,
        name: teacher.name,
        email: teacher.email,
        department: teacher.department,
        subjects: teacher.subjects,
        all_subjects: subjectsArray,
        mobile: teacher.mobile,
        faculty: teacher.faculty
      },
      classes: classSubjectsResult.rows
    });

  } catch (err) {
    console.error("❌ Error fetching teacher profile:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch teacher profile: " + err.message 
    });
  }
});

// ================= STUDENTS MANAGEMENT ENDPOINTS =================

// GET all students
app.get("/api/students", authenticateToken, async (req, res) => {
  try {
    console.log("📥 Fetching all students");
    const result = await pool.query(
      `SELECT id, student_code, roll_no, name, email, mobile, faculty, department, 
              stream, division, semester, academic_year, subjects
       FROM students
       ORDER BY id`
    );
    
    console.log(`✅ Found ${result.rows.length} students`);
    
    res.json({
      success: true,
      students: result.rows
    });
  } catch (err) {
    console.error("❌ Error fetching students:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch students: " + err.message 
    });
  }
});

// GET unique faculties from students
app.get("/api/faculties", authenticateToken, async (req, res) => {
  try {
    console.log("📥 Fetching faculties from students");
    const result = await pool.query(
      `SELECT DISTINCT faculty 
       FROM students 
       WHERE faculty IS NOT NULL AND faculty != ''
       ORDER BY faculty`
    );
    
    const faculties = result.rows.map(row => row.faculty);
    console.log(`✅ Found ${faculties.length} faculties`);
    
    res.json({
      success: true,
      faculties: faculties
    });
  } catch (err) {
    console.error("❌ Error fetching faculties:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch faculties: " + err.message 
    });
  }
});

// GET unique departments from students
app.get("/api/student-departments", authenticateToken, async (req, res) => {
  try {
    console.log("📥 Fetching departments from students");
    const result = await pool.query(
      `SELECT DISTINCT department 
       FROM students 
       WHERE department IS NOT NULL AND department != ''
       ORDER BY department`
    );
    
    const departments = result.rows.map(row => row.department);
    console.log(`✅ Found ${departments.length} departments`);
    
    res.json({
      success: true,
      departments: departments
    });
  } catch (err) {
    console.error("❌ Error fetching student departments:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch departments: " + err.message 
    });
  }
});

// GET STUDENT PROFILE
app.get("/api/student-profile", authenticateToken, async (req, res) => {
  try {
    console.log("📥 Fetching student profile for:", req.user.email);
    
    const result = await pool.query(
      `SELECT id, student_code, roll_no, name, email, mobile, faculty, 
              department, stream, division, semester, academic_year, subjects
       FROM students 
       WHERE email = $1`,
      [req.user.email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Student not found" 
      });
    }

    const student = result.rows[0];
    
    res.json({
      success: true,
      student: {
        id: student.id,
        student_code: student.student_code,
        roll_no: student.roll_no,
        name: student.name,
        email: student.email,
        mobile: student.mobile,
        faculty: student.faculty,
        department: student.department,
        stream: student.stream,
        division: student.division,
        semester: student.semester,
        academic_year: student.academic_year,
        subjects: student.subjects
      }
    });

  } catch (err) {
    console.error("❌ Error fetching student profile:", err);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch student profile: " + err.message 
    });
  }
});

// ================= STUDENT CSV UPLOAD WITH AUTO CLASS CREATION =================
app.post("/api/upload-students", authenticateToken, async (req, res) => {
  console.log("📥 Received Student CSV upload request");
  
  if (!req.body || !Array.isArray(req.body)) {
    console.error("❌ Invalid request body. Expected array of students.");
    return res.status(400).json({ 
      success: false,
      error: "Invalid request format. Expected array of students." 
    });
  }

  const students = req.body;
  console.log(`📊 Processing ${students.length} student records`);

  try {
    let inserted = 0;
    let updated = 0;
    let emailsSent = 0;
    let classesCreated = 0;
    let classesUpdated = 0;
    let studentsEnrolled = 0;
    let errors = [];

    // Process students and collect class data
    const classMap = new Map(); // To track classes and their students
    
    for (let i = 0; i < students.length; i++) {
      const row = students[i];
      
      console.log(`\n--- Processing student row ${i + 1} ---`);

      // Skip if row is empty
      if (!row || Object.keys(row).length === 0) {
        console.log("Skipping empty row");
        continue;
      }

      // ✅ VALIDATE REQUIRED FIELDS (NO student_code required)
      if (!row.roll_no || row.roll_no.toString().trim() === '') {
        const errorMsg = `Row ${i + 1}: Missing roll_no`;
        console.error("❌", errorMsg);
        errors.push(errorMsg);
        continue;
      }
      
      if (!row.name || !row.name.trim()) {
        const errorMsg = `Row ${i + 1}: Missing name`;
        console.error("❌", errorMsg);
        errors.push(errorMsg);
        continue;
      }
      
      if (!row.email || !row.email.trim()) {
        const errorMsg = `Row ${i + 1}: Missing email`;
        console.error("❌", errorMsg);
        errors.push(errorMsg);
        continue;
      }

      // Trim all fields
      const rollNo = row.roll_no.toString().trim();
      const name = row.name.trim();
      const email = row.email.trim();
      const mobile = row.mobile ? row.mobile.toString().trim() : null;
      const faculty = row.faculty ? row.faculty.trim() : null;
      const department = row.department ? row.department.trim() : null;
      const stream = row.stream ? row.stream.trim() : null;
      const division = row.division ? row.division.trim() : null;
      const semester = row.semester ? row.semester.toString().trim() : null;
      const academicYear = row.academic_year ? row.academic_year.trim() : '2025-26';

      // Normalize subjects
      let subjects = null;
      if (row.subjects && row.subjects.trim()) {
        subjects = row.subjects.split(",").map(s => s.trim()).join(",");
      }

      // ✅ AUTO-GENERATE STUDENT CODE
      const studentCode = generateStudentCode(row);
      
      console.log("Processing student:", { 
        generated_code: studentCode,
        roll_no: rollNo,
        name: name,
        email: email 
      });

      try {
        // ✅ CHECK FOR EXISTING STUDENT IN SAME EXACT CLASS
        const existingCheck = await pool.query(
          `SELECT id, student_code, password
           FROM students 
           WHERE roll_no = $1 
             AND (department = $2 OR (department IS NULL AND $2 IS NULL))
             AND (stream = $3 OR (stream IS NULL AND $3 IS NULL))
             AND (division = $4 OR (division IS NULL AND $4 IS NULL))
             AND (semester = $5 OR (semester IS NULL AND $5 IS NULL))
             AND (academic_year = $6 OR (academic_year IS NULL AND $6 IS NULL))`,
          [rollNo, department, stream, division, semester, academicYear]
        );

        let studentId;
        
        if (existingCheck.rows.length > 0) {
          // ✅ STUDENT EXISTS IN THIS EXACT CLASS - UPDATE
          studentId = existingCheck.rows[0].id;
          const existingCode = existingCheck.rows[0].student_code;
          
          console.log(`🔄 Updating existing student in class: ${existingCode}`);
          
          await pool.query(
            `UPDATE students SET
                name = COALESCE($1, name),
                email = COALESCE($2, email),
                mobile = COALESCE($3, mobile),
                faculty = COALESCE($4, faculty),
                subjects = COALESCE($5, subjects)
             WHERE id = $6`,
            [name, email, mobile, faculty, subjects, studentId]
          );
          updated++;
          
        } else {
          // ✅ NEW STUDENT IN THIS CLASS - INSERT
          console.log(`➕ Inserting new student with code: ${studentCode}`);
          
          const newStudentResult = await pool.query(
            `INSERT INTO students
             (student_code, roll_no, name, email, mobile, faculty, department, 
              stream, division, semester, academic_year, subjects,
              last_reset_request)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
             RETURNING id`,
            [
              studentCode,
              rollNo,
              name,
              email,
              mobile,
              faculty,
              department,
              stream,
              division,
              semester,
              academicYear,
              subjects
            ]
          );
          
          studentId = newStudentResult.rows[0].id;
          inserted++;
          
          // Send welcome email only to new students
          try {
            await sendStudentWelcomeEmail(name, email, studentCode, rollNo, faculty, department, stream);
            emailsSent++;
            console.log(`📧 Welcome email sent: ${email}`);
          } catch (emailError) {
            console.error(`❌ Email failed: ${email}`, emailError.message);
            errors.push(`Row ${i + 1}: Student added but email failed`);
          }
        }
        
        // ✅ ADD STUDENT TO CLASS MAP FOR BATCH PROCESSING
        const classKey = `${department || ''}-${stream || ''}-${division || ''}-${semester || ''}-${academicYear || ''}`;
        
        if (!classMap.has(classKey)) {
          classMap.set(classKey, {
            department,
            stream,
            division,
            semester,
            academic_year: academicYear,
            faculty,
            subjects: new Set(),
            studentIds: []
          });
        }
        
        const classInfo = classMap.get(classKey);
        classInfo.studentIds.push(studentId);
        
        // Add subjects to class
        if (subjects) {
          const subjectList = subjects.split(',');
          subjectList.forEach(subject => {
            if (subject.trim()) {
              classInfo.subjects.add(subject.trim());
            }
          });
        }
        
      } catch (err) {
        console.error(`❌ Row ${i + 1} error:`, err.message);
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }
    
    // ✅ CREATE/UPDATE CLASSES FROM THE MAP
    for (const [classKey, classInfo] of classMap) {
      try {
        const classCode = generateClassCode(classInfo);
        const className = `${classInfo.department || 'General'} - ${classInfo.stream || ''} ${classInfo.division || ''} - Sem ${classInfo.semester || 'N/A'} (${classInfo.academic_year || '2025-26'})`;
        const classSubjects = Array.from(classInfo.subjects).join(',');
        
        // Check if class exists
        const classResult = await pool.query(
          `SELECT id, subjects FROM classes 
           WHERE class_code = $1 
           OR (department = $2 AND stream = $3 AND division = $4 
               AND semester = $5 AND academic_year = $6)`,
          [
            classCode,
            classInfo.department,
            classInfo.stream,
            classInfo.division,
            classInfo.semester,
            classInfo.academic_year
          ]
        );
        
        let classId;
        
        if (classResult.rows.length > 0) {
          // Class exists - update subjects if needed
          classId = classResult.rows[0].id;
          const existingSubjects = classResult.rows[0].subjects;
          
          // Merge subjects
          if (classSubjects) {
            const existingSubjectList = existingSubjects ? existingSubjects.split(',').map(s => s.trim()) : [];
            const newSubjectList = classSubjects.split(',').map(s => s.trim());
            
            // Combine and deduplicate
            const allSubjects = [...new Set([...existingSubjectList, ...newSubjectList])].join(',');
            
            if (allSubjects !== existingSubjects) {
              await pool.query(
                `UPDATE classes SET subjects = $1, updated_at = NOW() WHERE id = $2`,
                [allSubjects, classId]
              );
              classesUpdated++;
            }
          }
          
        } else {
          // Create new class
          const newClassResult = await pool.query(
            `INSERT INTO classes 
             (class_code, class_name, department, stream, division, 
              semester, academic_year, faculty, subjects, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
             RETURNING id`,
            [
              classCode,
              className,
              classInfo.department,
              classInfo.stream,
              classInfo.division,
              classInfo.semester,
              classInfo.academic_year,
              classInfo.faculty,
              classSubjects
            ]
          );
          
          classId = newClassResult.rows[0].id;
          classesCreated++;
        }
        
        // ✅ ENROLL STUDENTS IN THE CLASS
        for (const studentId of classInfo.studentIds) {
          const enrollmentCheck = await pool.query(
            `SELECT id FROM class_students 
             WHERE class_id = $1 AND student_id = $2`,
            [classId, studentId]
          );
          
          if (enrollmentCheck.rows.length === 0) {
            // Get student's subjects
            const studentResult = await pool.query(
              "SELECT subjects FROM students WHERE id = $1",
              [studentId]
            );
            
            const studentSubjects = studentResult.rows[0]?.subjects || classSubjects;
            
            await pool.query(
              `INSERT INTO class_students 
               (class_id, student_id, student_code, enrolled_subjects)
               VALUES ($1, $2, 
                       (SELECT student_code FROM students WHERE id = $2), 
                       $3)`,
              [classId, studentId, studentSubjects]
            );
            
            // Create subject enrollments for each subject
            if (studentSubjects) {
              const subjects = studentSubjects.split(',').map(s => s.trim());
              for (const subject of subjects) {
                if (subject) {
                  await pool.query(
                    `INSERT INTO subject_enrollments 
                     (student_id, class_id, subject)
                     VALUES ($1, $2, $3)
                     ON CONFLICT (student_id, class_id, subject) DO NOTHING`,
                    [studentId, classId, subject]
                  );
                }
              }
            }
            
            studentsEnrolled++;
          }
        }
        
      } catch (err) {
        console.error(`❌ Error creating class ${classKey}:`, err.message);
        errors.push(`Class creation error for ${classKey}: ${err.message}`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`Total students: ${students.length}`);
    console.log(`Inserted: ${inserted}, Updated: ${updated}`);
    console.log(`Classes created: ${classesCreated}, Classes updated: ${classesUpdated}`);
    console.log(`Students enrolled: ${studentsEnrolled}`);
    console.log(`Emails sent: ${emailsSent}`);
    console.log(`Errors: ${errors.length}`);
    
    res.json({
      success: true,
      message: `CSV processed. ${inserted} new students added, ${updated} existing updated, ${emailsSent} emails sent. Created ${classesCreated} new classes, updated ${classesUpdated} classes, enrolled ${studentsEnrolled} students.`,
      stats: {
        totalStudents: students.length,
        inserted: inserted,
        updated: updated,
        emailsSent: emailsSent,
        classesCreated: classesCreated,
        classesUpdated: classesUpdated,
        studentsEnrolled: studentsEnrolled,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    console.error("❌ Student CSV error:", err);
    res.status(500).json({ 
      success: false,
      error: "CSV processing failed: " + err.message 
    });
  }
});

// ================= FUNCTION TO SEND STUDENT WELCOME EMAIL =================
async function sendStudentWelcomeEmail(studentName, studentEmail, studentCode, rollNo, faculty, department, stream) {
  const loginLink = `http://localhost:5000/login.html`;
  
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2c3e50, #34495e); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0; }
            .info-box { background: white; border-left: 4px solid #3498db; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .btn { display: inline-block; background: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
            .steps { background: #e8f4fc; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .step { margin: 10px 0; padding-left: 20px; position: relative; }
            .step:before { content: "✓"; position: absolute; left: 0; color: #27ae60; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #777; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h2>🎓 Modern College LMS</h2>
            <p>Student Account Created</p>
        </div>
        
        <div class="content">
            <h3>Dear ${studentName},</h3>
            <p>Welcome to <strong>Modern College of Arts, Science and Commerce, Warje Pune</strong>!</p>
            <p>Your student account has been successfully created in our Learning Management System (LMS).</p>
            
            <div class="info-box">
                <h4>📋 Your Account Details:</h4>
                <p><strong>Student Code:</strong> ${studentCode}</p>
                ${rollNo ? `<p><strong>Roll No:</strong> ${rollNo}</p>` : ''}
                <p><strong>Name:</strong> ${studentName}</p>
                <p><strong>Email:</strong> ${studentEmail}</p>
                ${faculty ? `<p><strong>Faculty:</strong> ${faculty}</p>` : ''}
                ${department ? `<p><strong>Department:</strong> ${department}</p>` : ''}
                ${stream ? `<p><strong>Stream:</strong> ${stream}</p>` : ''}
                <p><strong>Academic Year:</strong> 2025-26</p>
            </div>
            
            <div class="steps">
                <h4>🔑 How to Set Your Password:</h4>
                <div class="step">Go to Login Page: <a href="${loginLink}">${loginLink}</a></div>
                <div class="step">Click "Forgot Password" link</div>
                <div class="step">Enter your email: <strong>${studentEmail}</strong></div>
                <div class="step">Check email for password setup link</div>
                <div class="step">Set your password and login</div>
            </div>
            
            <a href="${loginLink}" class="btn">Go to Login Page</a>
            
            <p><strong>📝 Password Requirements:</strong></p>
            <ul>
                <li>Minimum 8 characters</li>
                <li>Include uppercase and lowercase letters</li>
                <li>Include at least one number</li>
                <li>Include at least one special character</li>
            </ul>
            
            <p><strong>📞 Need Help?</strong></p>
            <ul>
                <li>Admin Email: admin@moderncollege.edu</li>
                <li>Help Desk: 020-12345678</li>
                <li>IT Support: Ext. 555</li>
            </ul>
            
            <div class="footer">
                <p>Modern College of Arts, Science and Commerce</p>
                <p>Warje, Pune - 411058 | www.moderncollege.edu</p>
                <p>© 2025 Modern College LMS. All rights reserved.</p>
                <p><em>This is an automated email. Please do not reply.</em></p>
            </div>
        </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: '"Modern College LMS" <lms987565@gmail.com>',
    to: studentEmail,
    subject: `🎓 Welcome to Modern College LMS - Student Account Created`,
    html: emailHtml
  };

  return transporter.sendMail(mailOptions);
}

// ================= FUNCTION TO SEND TEACHER WELCOME EMAIL =================
async function sendTeacherWelcomeEmail(teacherName, teacherEmail, teacherCode, mobile, department) {
  const loginLink = `http://localhost:5000/login.html`;
  
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #2c3e50, #34495e); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0; }
            .info-box { background: white; border-left: 4px solid #3498db; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .btn { display: inline-block; background: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
            .steps { background: #e8f4fc; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .step { margin: 10px 0; padding-left: 20px; position: relative; }
            .step:before { content: "✓"; position: absolute; left: 0; color: #27ae60; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #777; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h2>🎓 Modern College LMS</h2>
            <p>Teacher Account Created</p>
        </div>
        
        <div class="content">
            <h3>Dear ${teacherName},</h3>
            <p>Welcome to <strong>Modern College of Arts, Science and Commerce, Warje Pune</strong>!</p>
            <p>Your teacher account has been successfully created in our Learning Management System (LMS).</p>
            
            <div class="info-box">
                <h4>📋 Your Account Details:</h4>
                <p><strong>Teacher Code:</strong> ${teacherCode}</p>
                <p><strong>Name:</strong> ${teacherName}</p>
                <p><strong>Email:</strong> ${teacherEmail}</p>
                ${mobile ? `<p><strong>Mobile:</strong> ${mobile}</p>` : ''}
                ${department ? `<p><strong>Department:</strong> ${department}</p>` : ''}
                <p><strong>Academic Year:</strong> 2025-26</p>
            </div>
            
            <div class="steps">
                <h4>🔑 How to Set Your Password:</h4>
                <div class="step">Go to Login Page: <a href="${loginLink}">${loginLink}</a></div>
                <div class="step">Click "Forgot Password" link</div>
                <div class="step">Enter your email: <strong>${teacherEmail}</strong></div>
                <div class="step">Check email for password setup link</div>
                <div class="step">Set your password and login</div>
            </div>
            
            <a href="${loginLink}" class="btn">Go to Login Page</a>
            
            <p><strong>📝 Password Requirements:</strong></p>
            <ul>
                <li>Minimum 8 characters</li>
                <li>Include uppercase and lowercase letters</li>
                <li>Include at least one number</li>
                <li>Include at least one special character</li>
            </ul>
            
            <p><strong>📞 Need Help?</strong></p>
            <ul>
                <li>Admin Email: admin@moderncollege.edu</li>
                <li>Help Desk: 020-12345678</li>
                <li>IT Support: Ext. 555</li>
            </ul>
            
            <div class="footer">
                <p>Modern College of Arts, Science and Commerce</p>
                <p>Warje, Pune - 411058 | www.moderncollege.edu</p>
                <p>© 2025 Modern College LMS. All rights reserved.</p>
                <p><em>This is an automated email. Please do not reply.</em></p>
            </div>
        </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: '"Modern College LMS" <lms987565@gmail.com>',
    to: teacherEmail,
    subject: `🎓 Welcome to Modern College LMS - Teacher Account Created`,
    html: emailHtml
  };

  return transporter.sendMail(mailOptions);
}

// ================= VERIFY RESET TOKEN =================
app.post("/api/verify-reset-token", async (req, res) => {
  try {
    const { token } = req.body;
    
    let result;
    let userType = '';
    
    // Check admin table first
    result = await pool.query(
      "SELECT id, email, name, reset_token_expiry FROM admin WHERE reset_token = $1",
      [token]
    );
    
    if (result.rows.length > 0) {
      userType = 'admin';
    } else {
      // Check teachers table
      result = await pool.query(
        "SELECT id, email, name, teacher_code, department, reset_token_expiry FROM teachers WHERE reset_token = $1",
        [token]
      );
      userType = 'teachers';
      
      if (result.rows.length === 0) {
        // Check students table
        result = await pool.query(
          "SELECT id, email, name, student_code, department, reset_token_expiry FROM students WHERE reset_token = $1",
          [token]
        );
        userType = 'students';
      }
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Invalid or expired token" 
      });
    }
    
    const user = result.rows[0];
    
    // Check expiry
    if (new Date() > new Date(user.reset_token_expiry)) {
      await pool.query(
        `UPDATE ${userType} SET reset_token = NULL, reset_token_expiry = NULL WHERE id = $1`,
        [user.id]
      );
      return res.status(400).json({ 
        success: false, 
        message: "Reset link has expired" 
      });
    }
    
    let responseData = {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || "User"
      }
    };
    
    if (userType === 'teachers') {
      responseData.user.teacher_code = user.teacher_code;
      responseData.user.department = user.department;
      responseData.user.userType = 'teacher';
    } else if (userType === 'students') {
      responseData.user.student_code = user.student_code;
      responseData.user.department = user.department;
      responseData.user.userType = 'student';
    } else {
      responseData.user.userType = 'admin';
    }
    
    res.json(responseData);
    
  } catch (err) {
    console.error("Verify token error:", err);
    res.status(500).json({ success: false, message: "Server error" });
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

    const isEmail = identifier.includes("@");
    let user = null;
    let userType = '';

    // 1️⃣ First check admin table
    if (isEmail) {
      const adminResult = await pool.query(
        "SELECT * FROM admin WHERE email = $1",
        [identifier]
      );
      if (adminResult.rows.length > 0) {
        user = adminResult.rows[0];
        userType = 'admin';
      }
    } else {
      // If not email, could be student_id for admin
      const adminResult = await pool.query(
        "SELECT * FROM admin WHERE student_id = $1",
        [identifier]
      );
      if (adminResult.rows.length > 0) {
        user = adminResult.rows[0];
        userType = 'admin';
      }
    }

    // 2️⃣ If not found in admin, check teachers table
    if (!user) {
      let teacherResult;
      if (isEmail) {
        teacherResult = await pool.query(
          "SELECT * FROM teachers WHERE email = $1",
          [identifier]
        );
      } else {
        // Try teacher_code
        teacherResult = await pool.query(
          "SELECT * FROM teachers WHERE teacher_code = $1",
          [identifier]
        );
      }
      
      if (teacherResult.rows.length > 0) {
        user = teacherResult.rows[0];
        userType = 'teachers';
      }
    }

    // 3️⃣ If not found in teachers, check students table
    if (!user) {
      let studentResult;
      if (isEmail) {
        studentResult = await pool.query(
          "SELECT * FROM students WHERE email = $1",
          [identifier]
        );
      } else {
        // Try student_code
        studentResult = await pool.query(
          "SELECT * FROM students WHERE student_code = $1",
          [identifier]
        );
      }
      
      if (studentResult.rows.length > 0) {
        user = studentResult.rows[0];
        userType = 'students';
      }
    }

    // 4️⃣ If not found anywhere
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this Email / ID"
      });
    }

    // Check daily reset attempts (separate for admin/teacher/student)
    const now = new Date();
    const today = new Date().toISOString().split("T")[0];

    if (user.reset_attempt_date !== today) {
      await pool.query(
        `UPDATE ${userType}
         SET reset_attempts = 0,
             reset_attempt_date = $1
         WHERE id = $2`,
        [today, user.id]
      );
    }

    if (user.reset_attempts >= 3) {
      return res.status(429).json({
        success: false,
        message: "Daily reset limit reached. Try again tomorrow."
      });
    }

    // Check time between requests
    if (user.last_reset_request) {
      const diff = (now - new Date(user.last_reset_request)) / 1000;
      if (diff < 120) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${Math.ceil(120 - diff)} seconds before retrying`
        });
      }
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

    await pool.query(
      `UPDATE ${userType}
       SET reset_token = $1,
           reset_token_expiry = $2,
           reset_attempts = reset_attempts + 1,
           last_reset_request = $3,
           reset_attempt_date = $4
       WHERE id = $5`,
      [resetToken, expiry, now, today, user.id]
    );

    const resetLink = `http://localhost:5000/reset.html?token=${resetToken}`;

    // Send appropriate email based on user type
    if (userType === 'admin') {
      await transporter.sendMail({
        from: "LMS Support <lms987565@gmail.com>",
        to: user.email,
        subject: "Reset Your LMS Password",
        html: `
          <h3>Password Reset Request</h3>
          <p>This link will expire in <b>2 minutes</b>.</p>
          <a href="${resetLink}">${resetLink}</a>
          <p>If you didn't request this, ignore this email.</p>
        `
      });
    } else if (userType === 'teachers') {
      // Teacher email
      await transporter.sendMail({
        from: '"Modern College LMS" <lms987565@gmail.com>',
        to: user.email,
        subject: "🔐 Password Reset - Teacher Account",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h2>Modern College LMS</h2>
              <p>Teacher Password Reset</p>
            </div>
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
              <h3>Dear ${user.name || 'Teacher'},</h3>
              <p>You requested a password reset for your teacher account.</p>
              <p><strong>Click the button below to reset your password:</strong></p>
              <a href="${resetLink}" style="display: inline-block; background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0;">Reset Password</a>
              
              <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #27ae60;">
                <h4>📋 Your Account Details:</h4>
                <p><strong>Name:</strong> ${user.name || 'Teacher'}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                ${user.teacher_code ? `<p><strong>Teacher Code:</strong> ${user.teacher_code}</p>` : ''}
                ${user.department ? `<p><strong>Department:</strong> ${user.department}</p>` : ''}
              </div>
              
              <p><strong>Note:</strong> This link will expire in <strong>2 minutes</strong>.</p>
              <p>If you didn't request this, please ignore this email and contact admin immediately.</p>
            </div>
          </div>
        `
      });
    } else {
      // Student email
      await transporter.sendMail({
        from: '"Modern College LMS" <lms987565@gmail.com>',
        to: user.email,
        subject: "🔐 Password Reset - Student Account",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h2>Modern College LMS</h2>
              <p>Student Password Reset</p>
            </div>
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
              <h3>Dear ${user.name || 'Student'},</h3>
              <p>You requested a password reset for your student account.</p>
              <p><strong>Click the button below to reset your password:</strong></p>
              <a href="${resetLink}" style="display: inline-block; background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0;">Reset Password</a>
              
              <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #27ae60;">
                <h4>📋 Your Account Details:</h4>
                <p><strong>Name:</strong> ${user.name || 'Student'}</p>
                <p><strong>Email:</strong> ${user.email}</p>
                ${user.student_code ? `<p><strong>Student Code:</strong> ${user.student_code}</p>` : ''}
                ${user.department ? `<p><strong>Department:</strong> ${user.department}</p>` : ''}
              </div>
              
              <p><strong>Note:</strong> This link will expire in <strong>2 minutes</strong>.</p>
              <p>If you didn't request this, please ignore this email and contact admin immediately.</p>
            </div>
          </div>
        `
      });
    }

    res.json({ 
      success: true,
      message: "Reset link sent successfully" 
    });

  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ 
      success: false,
      message: "Server error" 
    });
  }
});

// ================= RESET PASSWORD =================
app.post("/api/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    console.log(`🔐 Reset attempt with token: ${token ? token.substring(0, 10) + '...' : 'no token'}`);

    let record;
    let userType = '';
    
    // Check admin table first
    record = await pool.query(
      "SELECT * FROM admin WHERE reset_token = $1",
      [token]
    );
    
    if (record.rows.length > 0) {
      userType = 'admin';
    } else {
      // Check teachers table
      record = await pool.query(
        "SELECT * FROM teachers WHERE reset_token = $1",
        [token]
      );
      userType = 'teachers';
      
      if (record.rows.length === 0) {
        // Check students table
        record = await pool.query(
          "SELECT * FROM students WHERE reset_token = $1",
          [token]
        );
        userType = 'students';
      }
    }

    if (record.rows.length === 0) {
      console.log(`❌ No user found with reset token`);
      return res.status(400).json({ 
        success: false,
        message: "Invalid or expired link" 
      });
    }

    const user = record.rows[0];
    console.log(`✅ ${userType} found: ${user.email}, Expiry: ${user.reset_token_expiry}`);

    if (new Date() > new Date(user.reset_token_expiry)) {
      console.log(`❌ Reset token expired for ${user.email}`);
      await pool.query(
        `UPDATE ${userType} 
         SET reset_token = NULL, reset_token_expiry = NULL 
         WHERE id = $1`,
        [user.id]
      );
      return res.status(400).json({ 
        success: false,
        message: "Reset link expired" 
      });
    }

    console.log(`🔑 Hashing new password for ${user.email}`);
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `UPDATE ${userType}
       SET password = $1,
           reset_token = NULL,
           reset_token_expiry = NULL
       WHERE id = $2`,
      [hashedPassword, user.id]
    );

    console.log(`✅ Password updated successfully for ${user.email}`);

    // Send confirmation email based on user type
    let redirectTo = 'login.html';
    
    if (userType === 'admin') {
      await transporter.sendMail({
        from: "LMS Support <lms987565@gmail.com>",
        to: user.email,
        subject: "Password Changed Successfully",
        html: `
          <h3>Password Updated</h3>
          <p>Your password was changed successfully.</p>
          <p>If this wasn't you, contact support immediately.</p>
        `
      });
      redirectTo = 'admin.html';
    } else if (userType === 'teachers') {
      await transporter.sendMail({
        from: '"Modern College LMS" <lms987565@gmail.com>',
        to: user.email,
        subject: '✅ Password Set Successfully - Teacher Account',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #27ae60; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h2>Modern College LMS</h2>
              <p>Password Set Successfully</p>
            </div>
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
              <h3>Dear ${user.name || 'Teacher'},</h3>
              <p>Your password has been set successfully for your Modern College LMS account.</p>
              <p>You can now login using:</p>
              <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0; border: 2px solid #3498db;">
                <p><strong>Login URL:</strong> <a href="http://localhost:5000/login.html">http://localhost:5000/login.html</a></p>
                <p><strong>Email:</strong> ${user.email}</p>
              </div>
              <p>If you have any issues, please contact the admin department.</p>
            </div>
          </div>
        `
      });
      redirectTo = 'teacher.html';
    } else {
      await transporter.sendMail({
        from: '"Modern College LMS" <lms987565@gmail.com>',
        to: user.email,
        subject: '✅ Password Set Successfully - Student Account',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #27ae60; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h2>Modern College LMS</h2>
              <p>Password Set Successfully</p>
            </div>
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0;">
              <h3>Dear ${user.name || 'Student'},</h3>
              <p>Your password has been set successfully for your Modern College LMS account.</p>
              <p>You can now login using:</p>
              <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0; border: 2px solid #3498db;">
                <p><strong>Login URL:</strong> <a href="http://localhost:5000/login.html">http://localhost:5000/login.html</a></p>
                <p><strong>Email:</strong> ${user.email}</p>
              </div>
              <p>If you have any issues, please contact the admin department.</p>
            </div>
          </div>
        `
      });
      redirectTo = 'student.html';
    }

    res.json({
      success: true,
      message: "Password reset successful",
      redirectTo: redirectTo
    });

  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ 
      success: false,
      message: "Server error: " + err.message 
    });
  }
});

// ================= TEST EMAIL ENDPOINT =================
app.get("/api/test-email", async (req, res) => {
  try {
    const testEmail = "lms987565@gmail.com";
    
    await transporter.sendMail({
      from: '"Modern College LMS" <lms987565@gmail.com>',
      to: testEmail,
      subject: "📧 Test Email from LMS",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>✅ Test Email Successful!</h2>
          <p>This is a test email from the Modern College LMS system.</p>
          <p>Time sent: ${new Date().toLocaleString()}</p>
        </div>
      `
    });
    
    res.json({ success: true, message: "Test email sent successfully" });
  } catch (error) {
    console.error("Test email error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================= CLASS MANAGEMENT ENDPOINTS =================

// GET all classes
app.get("/api/classes", authenticateToken, async (req, res) => {
  try {
    console.log("📥 Fetching all classes");
    const result = await pool.query(
      `SELECT c.*, 
              COUNT(DISTINCT cs.student_id) as student_count,
              COUNT(DISTINCT ct.teacher_id) as teacher_count
       FROM classes c
       LEFT JOIN class_students cs ON c.id = cs.class_id
       LEFT JOIN class_teachers ct ON c.id = ct.class_id
       GROUP BY c.id
       ORDER BY c.academic_year DESC, c.department, c.semester`
    );
    
    console.log(`✅ Found ${result.rows.length} classes`);
    
    res.json({
      success: true,
      classes: result.rows
    });
  } catch (err) {
    console.error("❌ Error fetching classes:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch classes: " + err.message 
    });
  }
});

// GET class by ID
app.get("/api/classes/:id", authenticateToken, async (req, res) => {
  try {
    const classId = req.params.id;
    console.log(`📥 Fetching class ID: ${classId}`);
    
    // Get class details
    const classResult = await pool.query(
      `SELECT c.*, 
              COUNT(DISTINCT cs.student_id) as student_count,
              COUNT(DISTINCT ct.teacher_id) as teacher_count
       FROM classes c
       LEFT JOIN class_students cs ON c.id = cs.class_id
       LEFT JOIN class_teachers ct ON c.id = ct.class_id
       WHERE c.id = $1
       GROUP BY c.id`,
      [classId]
    );
    
    if (classResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Class not found" 
      });
    }
    
    const classInfo = classResult.rows[0];
    
    // Get enrolled students
    const studentsResult = await pool.query(
      `SELECT s.id, s.student_code, s.name, s.email, s.roll_no,
              cs.enrolled_subjects, cs.enrollment_date
       FROM students s
       JOIN class_students cs ON s.id = cs.student_id
       WHERE cs.class_id = $1
       ORDER BY s.roll_no`,
      [classId]
    );
    
    // Get assigned teachers
    const teachersResult = await pool.query(
      `SELECT t.id, t.teacher_code, t.name, t.email, t.department,
              ct.subjects, ct.assigned_date, ct.is_primary, ct.id as assignment_id
       FROM teachers t
       JOIN class_teachers ct ON t.id = ct.teacher_id
       WHERE ct.class_id = $1
       ORDER BY ct.is_primary DESC, t.name`,
      [classId]
    );
    
    // Get unique subjects from class
    const classSubjects = classInfo.subjects ? classInfo.subjects.split(',').map(s => s.trim()).filter(s => s) : [];
    
    res.json({
      success: true,
      class: classInfo,
      students: studentsResult.rows,
      teachers: teachersResult.rows,
      subjects: classSubjects
    });
    
  } catch (err) {
    console.error("❌ Error fetching class details:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch class details: " + err.message 
    });
  }
});

// CREATE CLASS MANUALLY
app.post("/api/classes", authenticateToken, async (req, res) => {
  try {
    const { class_name, department, stream, division, semester, academic_year, faculty, subjects } = req.body;
    
    if (!class_name || !department) {
      return res.status(400).json({
        success: false,
        message: "Class name and department are required"
      });
    }
    
    // Generate class code
    const classCode = generateClassCode({
      department,
      stream,
      division,
      semester,
      academic_year: academic_year || '2025-26'
    });
    
    // Check if class already exists
    const existingClass = await pool.query(
      `SELECT id FROM classes WHERE class_code = $1 
       OR (department = $2 AND stream = $3 AND division = $4 
           AND semester = $5 AND academic_year = $6)`,
      [classCode, department, stream, division, semester, academic_year || '2025-26']
    );
    
    if (existingClass.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Class already exists with these parameters"
      });
    }
    
    // Create class
    const result = await pool.query(
      `INSERT INTO classes 
       (class_code, class_name, department, stream, division, 
        semester, academic_year, faculty, subjects, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING id, class_code, class_name`,
      [
        classCode,
        class_name,
        department,
        stream,
        division,
        semester,
        academic_year || '2025-26',
        faculty,
        subjects
      ]
    );
    
    res.json({
      success: true,
      message: "Class created successfully",
      class: result.rows[0]
    });
    
  } catch (err) {
    console.error("❌ Error creating class:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to create class: " + err.message 
    });
  }
});

// DELETE CLASS
app.delete("/api/classes/:id", authenticateToken, async (req, res) => {
  try {
    const classId = req.params.id;
    
    // Check if class exists
    const classCheck = await pool.query(
      "SELECT id, class_name FROM classes WHERE id = $1",
      [classId]
    );
    
    if (classCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Class not found"
      });
    }
    
    // Delete class (CASCADE will handle related records)
    await pool.query("DELETE FROM classes WHERE id = $1", [classId]);
    
    res.json({
      success: true,
      message: `Class "${classCheck.rows[0].class_name}" deleted successfully`
    });
    
  } catch (err) {
    console.error("❌ Error deleting class:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to delete class: " + err.message 
    });
  }
});

// ASSIGN TEACHER TO CLASS
app.post("/api/assign-teacher", authenticateToken, async (req, res) => {
  try {
    const { class_id, teacher_id, subjects, is_primary } = req.body;
    
    // Validate
    if (!class_id || !teacher_id || !subjects) {
      return res.status(400).json({
        success: false,
        message: "Class ID, Teacher ID, and Subjects are required"
      });
    }
    
    // Check if class exists
    const classCheck = await pool.query(
      "SELECT id, class_name FROM classes WHERE id = $1",
      [class_id]
    );
    
    if (classCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Class not found"
      });
    }
    
    // Check if teacher exists
    const teacherCheck = await pool.query(
      "SELECT id, name FROM teachers WHERE id = $1",
      [teacher_id]
    );
    
    if (teacherCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found"
      });
    }
    
    // Assign teacher to class
    await pool.query(
      `INSERT INTO class_teachers 
       (class_id, teacher_id, subjects, is_primary, assigned_date)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (class_id, teacher_id, subjects) DO UPDATE SET
       is_primary = EXCLUDED.is_primary, assigned_date = NOW()`,
      [class_id, teacher_id, subjects, is_primary || false]
    );
    
    res.json({
      success: true,
      message: "Teacher assigned to class successfully"
    });
    
  } catch (err) {
    console.error("❌ Error assigning teacher:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to assign teacher: " + err.message 
    });
  }
});

// ================= UPDATE TEACHER ASSIGNMENT =================
app.put("/api/class-teachers/:id", authenticateToken, async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const { subjects, is_primary } = req.body;
    
    if (!subjects) {
      return res.status(400).json({
        success: false,
        message: "Subjects are required"
      });
    }
    
    // Update teacher assignment
    await pool.query(
      `UPDATE class_teachers 
       SET subjects = $1, is_primary = $2, assigned_date = NOW()
       WHERE id = $3`,
      [subjects, is_primary || false, assignmentId]
    );
    
    res.json({
      success: true,
      message: "Teacher assignment updated successfully"
    });
    
  } catch (err) {
    console.error("❌ Error updating teacher assignment:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to update teacher assignment: " + err.message 
    });
  }
});

// ================= DELETE TEACHER ASSIGNMENT =================
app.delete("/api/class-teachers/:id", authenticateToken, async (req, res) => {
  try {
    const assignmentId = req.params.id;
    
    // Delete teacher assignment
    await pool.query("DELETE FROM class_teachers WHERE id = $1", [assignmentId]);
    
    res.json({
      success: true,
      message: "Teacher removed from class successfully"
    });
    
  } catch (err) {
    console.error("❌ Error removing teacher from class:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to remove teacher: " + err.message 
    });
  }
});

// GET STUDENT'S CLASSES
app.get("/api/student-classes", authenticateToken, async (req, res) => {
  try {
    console.log("📥 Fetching student classes for:", req.user.email);
    
    // Get student ID
    const studentResult = await pool.query(
      "SELECT id FROM students WHERE email = $1",
      [req.user.email]
    );
    
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Student not found" 
      });
    }
    
    const studentId = studentResult.rows[0].id;
    
    // Get classes
    const result = await pool.query(
      `SELECT c.*, cs.enrolled_subjects,
              COUNT(DISTINCT se.subject) as enrolled_subject_count
       FROM classes c
       JOIN class_students cs ON c.id = cs.class_id
       LEFT JOIN subject_enrollments se ON c.id = se.class_id AND se.student_id = $1
       WHERE cs.student_id = $1
       GROUP BY c.id, cs.enrolled_subjects
       ORDER BY c.academic_year DESC, c.semester`,
      [studentId]
    );
    
    res.json({
      success: true,
      classes: result.rows
    });
    
  } catch (err) {
    console.error("❌ Error fetching student classes:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch student classes: " + err.message 
    });
  }
});

// GET TEACHER'S CLASSES
app.get("/api/teacher-classes", authenticateToken, async (req, res) => {
  try {
    console.log("📥 Fetching teacher classes for:", req.user.email);
    
    // Get teacher ID
    const teacherResult = await pool.query(
      "SELECT id FROM teachers WHERE email = $1",
      [req.user.email]
    );
    
    if (teacherResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Teacher not found" 
      });
    }
    
    const teacherId = teacherResult.rows[0].id;
    
    // Get classes
    const result = await pool.query(
      `SELECT c.*, ct.subjects as teaching_subjects, ct.is_primary, ct.id as assignment_id,
              COUNT(DISTINCT cs.student_id) as student_count
       FROM classes c
       JOIN class_teachers ct ON c.id = ct.class_id
       LEFT JOIN class_students cs ON c.id = cs.class_id
       WHERE ct.teacher_id = $1
       GROUP BY c.id, ct.subjects, ct.is_primary, ct.id
       ORDER BY c.academic_year DESC, c.semester`,
      [teacherId]
    );
    
    res.json({
      success: true,
      classes: result.rows
    });
    
  } catch (err) {
    console.error("❌ Error fetching teacher classes:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch teacher classes: " + err.message 
    });
  }
});

// ================= ANNOUNCEMENTS ENDPOINTS =================

// CREATE ANNOUNCEMENT
app.post("/api/announcements", authenticateToken, async (req, res) => {
  try {
    const { class_id, title, content, announcement_type } = req.body;
    
    // Get teacher ID from token
    const teacherResult = await pool.query(
      "SELECT id FROM teachers WHERE email = $1",
      [req.user.email]
    );
    
    if (teacherResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Only teachers can create announcements"
      });
    }
    
    const teacherId = teacherResult.rows[0].id;
    
    // Create announcement
    const result = await pool.query(
      `INSERT INTO announcements 
       (class_id, teacher_id, title, content, announcement_type, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id`,
      [class_id, teacherId, title, content, announcement_type || 'general']
    );
    
    res.json({
      success: true,
      message: "Announcement created successfully",
      announcement_id: result.rows[0].id
    });
    
  } catch (err) {
    console.error("❌ Error creating announcement:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to create announcement: " + err.message 
    });
  }
});

// GET ANNOUNCEMENTS FOR CLASS
app.get("/api/classes/:id/announcements", authenticateToken, async (req, res) => {
  try {
    const classId = req.params.id;
    
    const result = await pool.query(
      `SELECT a.*, t.name as teacher_name, t.teacher_code
       FROM announcements a
       JOIN teachers t ON a.teacher_id = t.id
       WHERE a.class_id = $1
       ORDER BY a.created_at DESC`,
      [classId]
    );
    
    res.json({
      success: true,
      announcements: result.rows
    });
    
  } catch (err) {
    console.error("❌ Error fetching announcements:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch announcements: " + err.message 
    });
  }
});

// GET ANNOUNCEMENTS FOR STUDENT
app.get("/api/student-announcements", authenticateToken, async (req, res) => {
  try {
    // Get student ID
    const studentResult = await pool.query(
      "SELECT id FROM students WHERE email = $1",
      [req.user.email]
    );
    
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Student not found" 
      });
    }
    
    const studentId = studentResult.rows[0].id;
    
    // Get announcements from all classes student is enrolled in
    const result = await pool.query(
      `SELECT DISTINCT a.*, c.class_name, t.name as teacher_name, 
              t.teacher_code, cs.enrolled_subjects
       FROM announcements a
       JOIN classes c ON a.class_id = c.id
       JOIN teachers t ON a.teacher_id = t.id
       JOIN class_students cs ON c.id = cs.class_id
       WHERE cs.student_id = $1
       ORDER BY a.created_at DESC
       LIMIT 50`,
      [studentId]
    );
    
    res.json({
      success: true,
      announcements: result.rows
    });
    
  } catch (err) {
    console.error("❌ Error fetching student announcements:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch announcements: " + err.message 
    });
  }
});

// ================= STUDY MATERIALS ENDPOINTS =================

// UPLOAD STUDY MATERIAL
app.post("/api/study-materials", authenticateToken, async (req, res) => {
  try {
    const { class_id, subject, title, description, material_type, 
            file_url, file_name, file_size, youtube_link } = req.body;
    
    // Get teacher ID from token
    const teacherResult = await pool.query(
      "SELECT id FROM teachers WHERE email = $1",
      [req.user.email]
    );
    
    if (teacherResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Only teachers can upload study materials"
      });
    }
    
    const teacherId = teacherResult.rows[0].id;
    
    // Upload study material
    const result = await pool.query(
      `INSERT INTO study_materials 
       (class_id, teacher_id, subject, title, description, material_type,
        file_url, file_name, file_size, youtube_link, upload_date, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
       RETURNING id`,
      [
        class_id, teacherId, subject, title, description, material_type,
        file_url, file_name, file_size, youtube_link
      ]
    );
    
    res.json({
      success: true,
      message: "Study material uploaded successfully",
      material_id: result.rows[0].id
    });
    
  } catch (err) {
    console.error("❌ Error uploading study material:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to upload study material: " + err.message 
    });
  }
});

// GET STUDY MATERIALS FOR CLASS
app.get("/api/classes/:id/materials", authenticateToken, async (req, res) => {
  try {
    const classId = req.params.id;
    const { subject } = req.query;
    
    let query = `
      SELECT sm.*, t.name as teacher_name, t.teacher_code
      FROM study_materials sm
      JOIN teachers t ON sm.teacher_id = t.id
      WHERE sm.class_id = $1 AND sm.is_active = true
    `;
    
    const params = [classId];
    
    if (subject) {
      query += " AND sm.subject = $2";
      params.push(subject);
    }
    
    query += " ORDER BY sm.upload_date DESC";
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      materials: result.rows
    });
    
  } catch (err) {
    console.error("❌ Error fetching study materials:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch study materials: " + err.message 
    });
  }
});

// GET STUDY MATERIALS FOR STUDENT
app.get("/api/student-materials", authenticateToken, async (req, res) => {
  try {
    // Get student ID
    const studentResult = await pool.query(
      "SELECT id FROM students WHERE email = $1",
      [req.user.email]
    );
    
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Student not found" 
      });
    }
    
    const studentId = studentResult.rows[0].id;
    
    // Get materials from classes student is enrolled in, filtered by enrolled subjects
    const result = await pool.query(
      `SELECT DISTINCT sm.*, c.class_name, t.name as teacher_name, 
              t.teacher_code, se.subject as enrolled_subject
       FROM study_materials sm
       JOIN classes c ON sm.class_id = c.id
       JOIN teachers t ON sm.teacher_id = t.id
       JOIN subject_enrollments se ON c.id = se.class_id AND sm.subject = se.subject
       WHERE se.student_id = $1 AND sm.is_active = true
       ORDER BY sm.upload_date DESC
       LIMIT 100`,
      [studentId]
    );
    
    res.json({
      success: true,
      materials: result.rows
    });
    
  } catch (err) {
    console.error("❌ Error fetching student materials:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch study materials: " + err.message 
    });
  }
});

// DELETE STUDY MATERIAL
app.delete("/api/study-materials/:id", authenticateToken, async (req, res) => {
  try {
    const materialId = req.params.id;
    
    // Get teacher ID from token
    const teacherResult = await pool.query(
      "SELECT id FROM teachers WHERE email = $1",
      [req.user.email]
    );
    
    if (teacherResult.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Only teachers can delete study materials"
      });
    }
    
    const teacherId = teacherResult.rows[0].id;
    
    // Check if material belongs to this teacher
    const materialCheck = await pool.query(
      "SELECT id FROM study_materials WHERE id = $1 AND teacher_id = $2",
      [materialId, teacherId]
    );
    
    if (materialCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Study material not found or you don't have permission to delete it"
      });
    }
    
    // Soft delete (set is_active = false)
    await pool.query(
      "UPDATE study_materials SET is_active = false, updated_at = NOW() WHERE id = $1",
      [materialId]
    );
    
    res.json({
      success: true,
      message: "Study material deleted successfully"
    });
    
  } catch (err) {
    console.error("❌ Error deleting study material:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to delete study material: " + err.message 
    });
  }
});

// ================= STUDENT SUBJECT ENROLLMENT ENDPOINTS =================

// GET STUDENT'S ENROLLED SUBJECTS
app.get("/api/student-subjects", authenticateToken, async (req, res) => {
  try {
    // Get student ID
    const studentResult = await pool.query(
      "SELECT id FROM students WHERE email = $1",
      [req.user.email]
    );
    
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Student not found" 
      });
    }
    
    const studentId = studentResult.rows[0].id;
    
    // Get enrolled subjects grouped by class
    const result = await pool.query(
      `SELECT c.id as class_id, c.class_name, c.class_code,
              ARRAY_AGG(DISTINCT se.subject) as subjects,
              COUNT(DISTINCT se.subject) as subject_count
       FROM classes c
       JOIN subject_enrollments se ON c.id = se.class_id
       WHERE se.student_id = $1
       GROUP BY c.id, c.class_name, c.class_code
       ORDER BY c.academic_year DESC, c.semester`,
      [studentId]
    );
    
    res.json({
      success: true,
      enrollments: result.rows
    });
    
  } catch (err) {
    console.error("❌ Error fetching student subjects:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch student subjects: " + err.message 
    });
  }
});

// UPDATE STUDENT'S SUBJECT ENROLLMENT
app.post("/api/update-student-subjects", authenticateToken, async (req, res) => {
  try {
    const { student_id, class_id, subjects } = req.body;
    
    // Validate admin
    const adminCheck = await pool.query(
      "SELECT id FROM admin WHERE email = $1",
      [req.user.email]
    );
    
    if (adminCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Only admin can update student subjects"
      });
    }
    
    // Remove existing subject enrollments for this student in this class
    await pool.query(
      "DELETE FROM subject_enrollments WHERE student_id = $1 AND class_id = $2",
      [student_id, class_id]
    );
    
    // Update class_students enrolled_subjects
    await pool.query(
      "UPDATE class_students SET enrolled_subjects = $1 WHERE student_id = $2 AND class_id = $3",
      [subjects, student_id, class_id]
    );
    
    // Add new subject enrollments
    if (subjects) {
      const subjectList = subjects.split(',').map(s => s.trim());
      for (const subject of subjectList) {
        if (subject) {
          await pool.query(
            `INSERT INTO subject_enrollments 
             (student_id, class_id, subject)
             VALUES ($1, $2, $3)`,
            [student_id, class_id, subject]
          );
        }
      }
    }
    
    res.json({
      success: true,
      message: "Student subjects updated successfully"
    });
    
  } catch (err) {
    console.error("❌ Error updating student subjects:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to update student subjects: " + err.message 
    });
  }
});

// ================= GET CURRENT USER PROFILE =================
app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    if (user.userType === 'admin') {
      const result = await pool.query(
        "SELECT id, email, name FROM admin WHERE id = $1",
        [user.id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: "Admin not found" 
        });
      }
      
      res.json({
        success: true,
        userType: 'admin',
        profile: result.rows[0]
      });
      
    } else if (user.userType === 'teacher') {
      const result = await pool.query(
        `SELECT id, teacher_code, name, email, department, subjects, mobile, faculty
         FROM teachers WHERE id = $1`,
        [user.id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: "Teacher not found" 
        });
      }
      
      res.json({
        success: true,
        userType: 'teacher',
        profile: result.rows[0]
      });
      
    } else if (user.userType === 'student') {
      const result = await pool.query(
        `SELECT id, student_code, roll_no, name, email, mobile, faculty, 
                department, stream, division, semester, academic_year, subjects
         FROM students WHERE id = $1`,
        [user.id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: "Student not found" 
        });
      }
      
      res.json({
        success: true,
        userType: 'student',
        profile: result.rows[0]
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid user type"
      });
    }
    
  } catch (err) {
    console.error("❌ Error fetching profile:", err);
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch profile: " + err.message 
    });
  }
});

// ================= FIX: Serve index.html for root route =================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// ================= HEALTH CHECK =================
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    endpoints: [
      "/api/login",
      "/api/protected",
      "/api/profile",
      "/api/teachers",
      "/api/departments", 
      "/api/teacher-subjects",
      "/api/teachers/:id/subjects",
      "/api/subjects",
      "/api/teachers/:id",
      "/api/all-teacher-subjects",
      "/api/upload-teachers",
      "/api/teacher-profile",
      "/api/students",
      "/api/faculties",
      "/api/student-departments",
      "/api/student-profile",
      "/api/upload-students",
      "/api/forgot-password",
      "/api/reset-password",
      "/api/verify-reset-token",
      "/api/classes",
      "/api/classes/:id",
      "/api/assign-teacher",
      "/api/class-teachers/:id (PUT)",
      "/api/class-teachers/:id (DELETE)",
      "/api/student-classes",
      "/api/teacher-classes",
      "/api/announcements",
      "/api/classes/:id/announcements",
      "/api/student-announcements",
      "/api/study-materials",
      "/api/classes/:id/materials",
      "/api/student-materials",
      "/api/student-subjects",
      "/api/update-student-subjects"
    ]
  });
});

// ================= START SERVER =================
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Available Endpoints:`);
  console.log(`   POST /api/login (Unified login for admin, teacher, student)`);
  console.log(`   GET  /api/protected`);
  console.log(`   GET  /api/profile (Get current user profile)`);
  console.log(`   GET  /api/teachers`);
  console.log(`   GET  /api/departments`);
  console.log(`   GET  /api/teacher-subjects (for current teacher)`);
  console.log(`   GET  /api/teachers/:id/subjects (for specific teacher)`);
  console.log(`   GET  /api/subjects (all available subjects)`);
  console.log(`   GET  /api/teachers/:id (teacher details)`);
  console.log(`   GET  /api/all-teacher-subjects`);
  console.log(`   POST /api/upload-teachers`);
  console.log(`   GET  /api/teacher-profile`);
  console.log(`   GET  /api/students`);
  console.log(`   GET  /api/faculties`);
  console.log(`   GET  /api/student-departments`);
  console.log(`   GET  /api/student-profile`);
  console.log(`   POST /api/upload-students (with auto class creation)`);
  console.log(`   POST /api/forgot-password (Admin, Teacher & Student)`);
  console.log(`   POST /api/reset-password (Admin, Teacher & Student)`);
  console.log(`   POST /api/verify-reset-token`);
  console.log(`   GET  /api/classes`);
  console.log(`   POST /api/classes (create manually)`);
  console.log(`   GET  /api/classes/:id`);
  console.log(`   DELETE /api/classes/:id`);
  console.log(`   POST /api/assign-teacher`);
  console.log(`   PUT    /api/class-teachers/:id (update teacher assignment)`);
  console.log(`   DELETE /api/class-teachers/:id (remove teacher assignment)`);
  console.log(`   GET  /api/student-classes`);
  console.log(`   GET  /api/teacher-classes`);
  console.log(`   POST /api/announcements`);
  console.log(`   GET  /api/classes/:id/announcements`);
  console.log(`   GET  /api/student-announcements`);
  console.log(`   POST /api/study-materials`);
  console.log(`   GET  /api/classes/:id/materials`);
  console.log(`   GET  /api/student-materials`);
  console.log(`   DELETE /api/study-materials/:id`);
  console.log(`   GET  /api/student-subjects`);
  console.log(`   POST /api/update-student-subjects`);
  console.log(`   GET  /api/health`);

});
