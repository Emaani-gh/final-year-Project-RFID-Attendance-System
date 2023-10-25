const express = require("express");
const router = express.Router();
const Lecturer = require("../models/lecturers");
const asyncHandler = require("../middleware/asyncHandler");
const bcrypt = require("bcrypt");
const { authenticateUser } = require("../middleware/authenticate");
const { setCacheControlHeaders } = require("../middleware/cashControlHabdler");
const Course = require("../models/course");
const jwt = require("jsonwebtoken");
const Student = require("../models/students");
const Attendance = require("../models/attendance");

/*========================GET ROUTE to RENDER THE LOGIN PAGE=================*/
router.get("/login", async (req, res) => {
  res.render("lecturerLogin");
});
/* ---------------------------------------------------------------------------*/

/*===================== POST ROUTE TO HANDLE USER LOG IN ================*/
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find the lecturer by the username
    const lecturer = await Lecturer.findOne({ username });

    if (!lecturer) {
      return res.status(404).json({ message: "incorrect Credentials" });
    }

    // Compare the provided password with the hashed password in the database
    const isPasswordValid = await bcrypt.compare(password, lecturer.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "incorrect credentials" });
    }

    // Generate a JWT token for authentication
    const lecturerToken = jwt.sign(
      { id: lecturer.lecturer_id },
      "lecturer jwt secret key"
    );

    // Set the token as a cookie with a 7-day expiration
    res.cookie("lecturerToken", lecturerToken, {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Return the token in the response
    res.json({ lecturerToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
/*------------------------------- end of post route ---------------------------------------------*/

/*===================== POST ROUTE TO HANDLE USER LOGOUT ================*/
router.post("/logout", async (req, res) => {
  // Clear the token cookie by setting it to an empty string and expiring it
  res.cookie("lecturerToken", "", { expires: new Date(0) });

  // Redirect the user to the login page or any other appropriate page
  res.redirect("/lecturer/login"); // You can change the route as needed
});

/* ==================================GET route to show the lecturer dashboard============================================*/
router.get(
  "/dashboard",
  setCacheControlHeaders,
  authenticateUser,
  async (req, res) => {
    try {
      const lecturerId = req.user.id;

      // Get lecturer's details
      const lecturer = await Lecturer.findOne({ lecturer_id: lecturerId });

      // Get lecturer's assigned courses
      const courses = await Course.find({ lecturer_id: lecturerId });

      // Fetch the unique week numbers for which attendance records exist
      const uniqueWeekNumbers = await Attendance.distinct("week_number", {
        course_id: { $in: courses.map((course) => course.course_code) },
      });

      res.render("lecturer_dashboard", {
        lecturer,
        courses,
        attendanceWeeks: uniqueWeekNumbers,
      });
    } catch (error) {
      console.error("Error showing lecturer dashboard:", error);
      res.status(500).json({
        error: "An error occurred while showing the lecturer dashboard",
      });
    }
  }
);
/*---------------------------------- end of get route --------------------------------------------------*/

/*============================POST ROUTE TO INITIATE ATTENDANCE MARKING BY LECTURER========== */
router.post(
  "/mark_attendance",
  asyncHandler(async (req, res) => {
    try {
      const { courseID, weekNumber } = req.body;

      // Find all students registered for the course
      const students = await Student.find({ courses: courseID });

      // Loop through each student
      for (const student of students) {
        // Create the attendance document for the specified week if it doesn't exist
        await Attendance.findOneAndUpdate(
          {
            student_id: student.student_id,
            course_id: courseID,
            week_number: weekNumber,
          },
          {
            student_id: student.student_id,
            course_id: courseID,
            week_number: weekNumber,
            attendance_status: "Absent",
            date: new Date(), // Set the current date
          },
          { upsert: true }
        );
      }

      // Redirect to the attendance marking page with selected course and week
      res.redirect(`/lecturer/mark_attendance/${courseID}/${weekNumber}`);
    } catch (error) {
      console.error("Error initiating attendance:", error);
      res.status(500).json({
        error: "An error occurred while initiating attendance",
      });
    }
  })
);
/*=================================end of post route ======================================*/

/* ============================ROUTE TO VIEW ATTENDANCE RECORDS==================================*/
router.post("/view_attendance", async (req, res) => {
  const { courseCode, weekNumber } = req.body;

  res.redirect(`/lecturer/view_attendance/${courseCode}/${weekNumber}`);
});

router.get(
  "/view_attendance/:courseCode/:weekNumber",
  asyncHandler(async (req, res) => {
    try {
      const { courseCode, weekNumber } = req.params;

      // Find the course and its students
      const course = await Course.findOne({ course_code: courseCode }).populate(
        "students"
      );

      // Find attendance records for the specified course and week
      const attendanceRecords = await Attendance.find({
        course_id: courseCode,
        week_number: parseInt(weekNumber),
      });

      res.render("view_attendance", { course, attendanceRecords, weekNumber });
    } catch (error) {
      console.error("Error fetching attendance records:", error);
      res.status(500).json({
        error: "An error occurred while fetching attendance records",
      });
    }
  })
);
/*------------------------------- end of view attendace record route -------------------------------------- */

/* =========================GET ROUTE TO ACCESS ATTENDANCE MARKING PAGE=================================*/
router.get(
  "/mark_attendance/:courseID/:week",
  asyncHandler(async (req, res) => {
    const { courseID, week } = req.params;
    res.render("index", { courseID, week });
  })
);
/*---------------------------------END OF ROUTE-------------------------------------------------------- */

router.get(
  "/create_course",
  asyncHandler(async (req, res) => {
    res.render("create_course");
  })
);

// Define a POST route to handle course creation
router.post("/create_course", authenticateUser, async (req, res) => {
  try {
    const { courseCode, courseName } = req.body;
    const lecturerId = req.user.id; // Assuming you have the lecturer's ID in the JWT payload

    // Check if the course code already exists
    const existingCourse = await Course.findOne({ course_code: courseCode });
    if (existingCourse) {
      return res.status(400).json({
        error: "A course with the same course code already exists",
      });
    }

    // Create a new course
    const newCourse = new Course({
      course_code: courseCode,
      course_name: courseName,
      lecturer_id: lecturerId,
    });

    await newCourse.save();

    res.status(201).json({ message: "Course created successfully" });
  } catch (error) {
    console.error("Error creating course:", error);
    res
      .status(500)
      .json({ error: "An error occurred while creating the course" });
  }
});

/* ====================================POST route to add a new lecturer =================================*/
router.post("/add", async (req, res) => {
  try {
    const { fName, lName, lecturer_id, email, username, password } = req.body;

    // Check if lecturer with the same lecturer_id or email already exists
    const existingLecturer = await Lecturer.findOne({
      $or: [{ lecturer_id }, { email }],
    });
    if (existingLecturer) {
      return res.status(400).json({
        error: "Lecturer with the same employee ID or email already exists",
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new lecturer with hashed password
    const newLecturer = new Lecturer({
      fName,
      lName,
      lecturer_id,
      email,
      password: hashedPassword,
      username,
    });

    // Save the lecturer to the database
    await newLecturer.save();

    res.status(201).json({ message: "Lecturer added successfully" });
  } catch (error) {
    console.error("Error adding lecturer:", error);
    res
      .status(500)
      .json({ error: "An error occurred while adding the lecturer" });
  }
});
/* ------------------------End of route-----------------------------------*/

/* ==================================ROUTE TO VIEW ATTENDACE FOR A COURSE ==================================== */
router.get("/view_attendance/:courseID", async (req, res) => {
  try {
    const { courseID } = req.params;
    const course = await Course.findById(courseID).populate("students");
    res.render("lecturerViewAttendance", { course });
  } catch (error) {
    console.error("Error fetching course attendance:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching course attendance" });
  }
});
/* ---------------------------------End of route ----------------------------------------------------------------------*/

/* ===============================GET route to get all lecturers========================================*/
router.get("/all", async (req, res) => {
  try {
    const lecturers = await Lecturer.find();
    res.status(200).json(lecturers);
  } catch (error) {
    console.error("Error fetching lecturers:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching lecturers" });
  }
});
/* ---------------------------------End of route ----------------------------------------------------------------------*/

module.exports = router;
