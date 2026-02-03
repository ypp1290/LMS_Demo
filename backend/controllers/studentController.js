const pool = require("../db");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

// Create email transporter (same as teacher)
const emailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "lms987565@gmail.com",
    pass: "mszc glaz lxdg aoti"
  }
});

exports.getAllStudents = async (req, res) => {
  try {
    console.log("📥 Fetching all students");
    const result = await pool.query(
      `SELECT student_code, roll_no, name, email, mobile, faculty, department, 
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
};

exports.getFaculties = async (req, res) => {
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
};

exports.getStudentDepartments = async (req, res) => {
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
};

exports.uploadStudentsCSV = async (req, res) => {
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
    let errors = [];

    for (let i = 0; i < students.length; i++) {
      const row = students[i];
      
      console.log(`\n--- Processing student row ${i + 1} ---`);

      // Skip if row is empty
      if (!row || Object.keys(row).length === 0) {
        console.log("Skipping empty row");
        continue;
      }

      // Validate required fields
      if (!row.student_code || !row.student_code.trim()) {
        const errorMsg = `Row ${i + 1}: Missing student_code`;
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
      const studentCode = row.student_code.trim();
      const rollNo = row.roll_no ? row.roll_no.trim() : null;
      const name = row.name.trim();
      const email = row.email.trim();
      const mobile = row.mobile ? row.mobile.trim() : null;
      const faculty = row.faculty ? row.faculty.trim() : null;
      const department = row.department ? row.department.trim() : null;
      const stream = row.stream ? row.stream.trim() : null;
      const division = row.division ? row.division.trim() : null;
      const semester = row.semester ? row.semester.trim() : null;
      const academicYear = row.academic_year ? row.academic_year.trim() : '2025-26';

      // Normalize subjects
      let subjects = null;
      if (row.subjects && row.subjects.trim()) {
        subjects = row.subjects.split(",").map(s => s.trim()).join(",");
      }

      console.log("Processing student:", { studentCode, name, email });

      try {
        // 1️⃣ Check if student already exists
        const existing = await pool.query(
          `SELECT id, password
           FROM students
           WHERE student_code = $1 OR email = $2`,
          [studentCode, email]
        );

        console.log(`Existing student records found: ${existing.rows.length}`);

        // =========================
        // 👉 INSERT NEW STUDENT (WITH RESET TOKEN)
        // =========================
        if (existing.rows.length === 0) {
          const resetToken = crypto.randomBytes(32).toString("hex");
          console.log(`Inserting new student: ${studentCode} - ${name}`);

          await pool.query(
            `INSERT INTO students
             (student_code, roll_no, name, email, mobile, faculty, department, 
              stream, division, semester, academic_year, subjects,
              reset_token, reset_token_expiry, last_reset_request)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                     NOW() + INTERVAL '30 minutes', NOW())`,
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
              subjects,
              resetToken
            ]
          );
          inserted++;
          console.log(`✅ Inserted new student: ${studentCode} - ${name}`);

          // Send registration email to student (EXACTLY LIKE TEACHER)
          try {
            await sendStudentRegistrationEmail(name, email, studentCode, rollNo, mobile, faculty, department, stream, resetToken);
            emailsSent++;
            console.log(`📧 Registration email sent to student: ${email}`);
          } catch (emailError) {
            console.error(`❌ Failed to send email to ${email}:`, emailError.message);
            errors.push(`Row ${i + 1}: Student added but email failed to send`);
          }

        } else {
          // =========================
          // 👉 UPDATE EXISTING STUDENT
          // =========================
          const studentId = existing.rows[0].id;
          console.log(`Updating existing student ID: ${studentId}`);

          await pool.query(
            `UPDATE students SET
                name           = COALESCE($1, name),
                roll_no        = COALESCE($2, roll_no),
                mobile         = COALESCE($3, mobile),
                faculty        = COALESCE($4, faculty),
                department     = COALESCE($5, department),
                stream         = COALESCE($6, stream),
                division       = COALESCE($7, division),
                semester       = COALESCE($8, semester),
                academic_year  = COALESCE($9, academic_year),
                subjects       = COALESCE($10, subjects)
             WHERE id = $11`,
            [
              name,
              rollNo,
              mobile,
              faculty,
              department,
              stream,
              division,
              semester,
              academicYear,
              subjects,
              studentId
            ]
          );
          updated++;
          console.log(`🔄 Updated existing student: ${studentCode} - ${name}`);
        }

      } catch (err) {
        console.error(`❌ Error processing student row ${i + 1}:`, err.message);
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }

    console.log(`\n📊 Student Processing Summary:`);
    console.log(`Total rows: ${students.length}`);
    console.log(`Inserted: ${inserted}`);
    console.log(`Updated: ${updated}`);
    console.log(`Emails sent: ${emailsSent}`);
    console.log(`Errors: ${errors.length}`);
    
    res.json({
      success: true,
      message: `CSV processed successfully. ${inserted} inserted, ${updated} updated, ${emailsSent} emails sent.`,
      stats: {
        total: students.length,
        inserted: inserted,
        updated: updated,
        emailsSent: emailsSent,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    console.error("❌ Student CSV merge error:", err);
    res.status(500).json({ 
      success: false,
      error: "CSV merge failed: " + err.message 
    });
  }
};

// Function to send registration email to student (EXACTLY LIKE TEACHER)
async function sendStudentRegistrationEmail(studentName, studentEmail, studentCode, rollNo, mobile, faculty, department, stream, resetToken) {
  const resetLink = `http://localhost:5500/reset.html?token=${resetToken}`;
  
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }
            .header {
                background: linear-gradient(135deg, #2c3e50, #34495e);
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 8px 8px 0 0;
            }
            .content {
                background: #f8f9fa;
                padding: 30px;
                border-radius: 0 0 8px 8px;
                border: 1px solid #e0e0e0;
            }
            .info-box {
                background: white;
                border-left: 4px solid #3498db;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .btn {
                display: inline-block;
                background: #27ae60;
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
                margin: 20px 0;
            }
            .steps {
                background: #e8f4fc;
                padding: 20px;
                border-radius: 5px;
                margin: 20px 0;
            }
            .step {
                margin: 10px 0;
                padding-left: 20px;
                position: relative;
            }
            .step:before {
                content: "✓";
                position: absolute;
                left: 0;
                color: #27ae60;
                font-weight: bold;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
                color: #777;
                font-size: 12px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h2>🎓 Modern College LMS</h2>
            <p>Student Account Registration</p>
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
                ${mobile ? `<p><strong>Mobile:</strong> ${mobile}</p>` : ''}
                ${faculty ? `<p><strong>Faculty:</strong> ${faculty}</p>` : ''}
                ${department ? `<p><strong>Department:</strong> ${department}</p>` : ''}
                ${stream ? `<p><strong>Stream:</strong> ${stream}</p>` : ''}
                <p><strong>Academic Year:</strong> 2025-26</p>
            </div>
            
            <div class="steps">
                <h4>🔐 Account Setup Instructions:</h4>
                <div class="step">Click the link below to set your password</div>
                <div class="step">Complete your profile after login</div>
                <div class="step">Access learning materials and course content</div>
            </div>
            
            <p><strong>⚠️ IMPORTANT:</strong> This link will expire in 30 minutes.</p>
            <a href="${resetLink}" class="btn">Set Your Password Now</a>
            
            <h4>📝 Password Requirements:</h4>
            <ul>
                <li>Minimum 8 characters</li>
                <li>Include uppercase and lowercase letters</li>
                <li>Include at least one number</li>
                <li>Include at least one special character</li>
            </ul>
            
            <h4>🔒 Security Note:</h4>
            <p>For security reasons, please:</p>
            <ul>
                <li>Do not share this link with anyone</li>
                <li>Set a strong, unique password</li>
                <li>Log out after each session</li>
                <li>Contact admin if you suspect unauthorized access</li>
            </ul>
            
            <h4>📞 Need Help?</h4>
            <p>If you encounter any issues:</p>
            <ul>
                <li>Email: admin@moderncollege.edu</li>
                <li>Help Desk: 020-12345678</li>
                <li>IT Support: Ext. 555</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>Modern College of Arts, Science and Commerce</p>
            <p>Warje, Pune - 411058 | www.moderncollege.edu</p>
            <p>© 2025 Modern College LMS. All rights reserved.</p>
            <p><em>This is an automated email. Please do not reply.</em></p>
        </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: '"Modern College LMS" <lms987565@gmail.com>',
    to: studentEmail,
    subject: `🎓 Welcome to Modern College LMS - Student Account Registration`,
    html: emailHtml,
    text: `Welcome to Modern College LMS!

Dear ${studentName},

Your student account has been created:
- Student Code: ${studentCode}
${rollNo ? `- Roll No: ${rollNo}\n` : ''}
- Name: ${studentName}
- Email: ${studentEmail}
${mobile ? `- Mobile: ${mobile}\n` : ''}${faculty ? `- Faculty: ${faculty}\n` : ''}${department ? `- Department: ${department}\n` : ''}${stream ? `- Stream: ${stream}\n` : ''}
To set your password, click: ${resetLink}
(This link expires in 30 minutes)

Steps to access:
1. Click the link above
2. Set your password
3. Log in with your email

Password requirements:
- Minimum 8 characters
- Uppercase & lowercase letters
- At least one number
- At least one special character

Need help? Contact admin@moderncollege.edu or call 020-12345678

Modern College of Arts, Science and Commerce
Warje, Pune - 411058`
  };

  return emailTransporter.sendMail(mailOptions);
}