const express = require("express");
const router = express.Router();
const { 
  getAllStudents,
  getFaculties,
  getStudentDepartments,
  uploadStudentsCSV 
} = require("../controllers/studentController");

router.get("/students", getAllStudents);
router.get("/faculties", getFaculties);
router.get("/student-departments", getStudentDepartments);
router.post("/upload-students", uploadStudentsCSV);

module.exports = router;