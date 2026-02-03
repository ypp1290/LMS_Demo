const express = require("express");
const router = express.Router();
const { 
  uploadTeachersCSV, 
  getAllTeachers,
  getDepartments 
} = require("../controllers/teacherController");

router.post("/upload-teachers", uploadTeachersCSV);
router.get("/teachers", getAllTeachers);
router.get("/departments", getDepartments);

module.exports = router;