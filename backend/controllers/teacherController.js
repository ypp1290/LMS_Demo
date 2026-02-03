const pool = require("../db");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

// Create email transporter
const emailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "lms987565@gmail.com",
    pass: "mszc glaz lxdg aoti"
  }
});

exports.uploadTeachersCSV = async (req, res) => {
  console.log("📥 Received CSV upload request");
  
  // Check if request body exists
  if (!req.body || !Array.isArray(req.body)) {
    console.error("❌ Invalid request body. Expected array of teachers.");
    return res.status(400).json({ 
      success: false,
      error: "Invalid request format. Expected array of teachers." 
    });
  }

  const teachers = req.body; // parsed CSV rows
  console.log(`📊 Processing ${teachers.length} teacher records`);

  try {
    let inserted = 0;
    let updated = 0;
    let emailsSent = 0;
    let errors = [];

    for (let i = 0; i < teachers.length; i++) {
      const row = teachers[i];
      
      // Log each row for debugging
      console.log(`\n--- Processing row ${i + 1} ---`);
      console.log("Raw row data:", row);

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
        console.log("Normalized subjects:", subjects);
      }

      console.log("Processed data:", {
        teacherCode, name, email, mobile, faculty, department, subjects
      });

      try {
        // 1️⃣ Check if teacher already exists
        console.log(`Checking if teacher exists: ${teacherCode} or ${email}`);
        const existing = await pool.query(
          `SELECT id, password
           FROM teachers
           WHERE teacher_code = $1 OR email = $2`,
          [teacherCode, email]
        );

        console.log(`Existing records found: ${existing.rows.length}`);

        // =========================
        // 👉 INSERT NEW TEACHER
        // =========================
        if (existing.rows.length === 0) {
          const resetToken = crypto.randomBytes(32).toString("hex");
          console.log(`Inserting new teacher: ${teacherCode} - ${name}`);

          await pool.query(
            `INSERT INTO teachers
             (teacher_code, name, email, mobile, faculty, department, subjects,
              reset_token, reset_token_expiry, last_reset_request)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                     NOW() + INTERVAL '30 minutes', NOW())`,
            [
              teacherCode,
              name,
              email,
              mobile,
              faculty,
              department,
              subjects,
              resetToken
            ]
          );
          inserted++;
          console.log(`✅ Inserted new teacher: ${teacherCode} - ${name}`);

          // Send registration email to teacher
          try {
            await sendTeacherRegistrationEmail(name, email, teacherCode, mobile, department, resetToken);
            emailsSent++;
            console.log(`📧 Registration email sent to: ${email}`);
          } catch (emailError) {
            console.error(`❌ Failed to send email to ${email}:`, emailError.message);
            errors.push(`Row ${i + 1}: Teacher added but email failed to send`);
          }

        } else {
          // =========================
          // 👉 UPDATE EXISTING TEACHER
          // =========================
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
        console.error("Error details:", err);
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }

    console.log(`\n📊 Processing Summary:`);
    console.log(`Total rows: ${teachers.length}`);
    console.log(`Inserted: ${inserted}`);
    console.log(`Updated: ${updated}`);
    console.log(`Emails sent: ${emailsSent}`);
    console.log(`Errors: ${errors.length}`);
    
    if (errors.length > 0) {
      console.log("Error details:", errors);
    }

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
    console.error("Full error:", err);
    res.status(500).json({ 
      success: false,
      error: "CSV merge failed: " + err.message 
    });
  }
};

// Function to send registration email to teacher
async function sendTeacherRegistrationEmail(teacherName, teacherEmail, teacherCode, mobile, department, resetToken) {
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
            <p>Teacher Account Registration</p>
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
                <h4>🔐 Account Setup Instructions:</h4>
                <div class="step">Click the link below to set your password</div>
                <div class="step">Complete your profile after login</div>
                <div class="step">Access teaching materials and student records</div>
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
    to: teacherEmail,
    subject: `🎓 Welcome to Modern College LMS - Account Registration`,
    html: emailHtml,
    text: `Welcome to Modern College LMS!

Dear ${teacherName},

Your teacher account has been created:
- Teacher Code: ${teacherCode}
- Name: ${teacherName}
- Email: ${teacherEmail}
${mobile ? `- Mobile: ${mobile}\n` : ''}${department ? `- Department: ${department}\n` : ''}
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

// NEW: Get all teachers
exports.getAllTeachers = async (req, res) => {
  try {
    console.log("📥 Fetching all teachers");
    const result = await pool.query(
      `SELECT teacher_code, name, email, department, subjects
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
};

// NEW: Get unique departments for filter
exports.getDepartments = async (req, res) => {
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
};