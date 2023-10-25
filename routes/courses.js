const express = require("express");
const Course = require("../models/course");
const router = express.Router();

/* ===========================POST route to add a new course============================= */
router.post("/add", async (req, res) => {
  try {
    const { course_code, course_name, lecturer_id } = req.body;

    // Check if course with the same course_code already exists
    const existingCourse = await Course.findOne({ course_code });
    if (existingCourse) {
      return res
        .status(400)
        .json({ error: "Course with the same course code already exists" });
    }

    // Create a new course
    const newCourse = new Course({
      course_code,
      course_name,
      lecturer_id,
      // Add other fields here
    });

    // Save the course to the database
    await newCourse.save();

    res.status(201).json({ message: "Course added successfully" });
  } catch (error) {
    console.error("Error adding course:", error);
    res
      .status(500)
      .json({ error: "An error occurred while adding the course" });
  }
});
/*==================================== end of route =================================== */

/*=============================== GET route to get all courses========================== */
router.get("/", async (req, res) => {
  try {
    const courses = await Course.find();
    res.status(200).json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ error: "An error occurred while fetching courses" });
  }
});
/*=================================================end of route ====================================================*/

module.exports = router;
