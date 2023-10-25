const express = require("express");
const router = express.Router();
const asyncHandler = require("../middleware/asyncHandler");
const Student = require("../models/students");
const Course = require("../models/course");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { authenticateUser } = require("../middleware/authenticate");
const { setCacheControlHeaders } = require("../middleware/cashControlHabdler");
const Attendance = require("../models/attendance");

/*========================GET ROUTE to RENDER THE LOGIN PAGE*/
router.get("/login", async (req, res) => {
  res.render("signIn");
});
/*--------------------------------END OF ROUTE---------------------------------------* / 

/*=====================GET ROUTE TO HANDLE STUDENT LOG IN================*/
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    // Find the student by the username
    const student = await Student.findOne({ username });

    if (!student) {
      return res.status(404).json({ message: "incorrect Credentials" });
    }

    // Compare the provided password with the hashed password in the database
    const isPasswordValid = await bcrypt.compare(password, student.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "incorrect credentials" });
    }

    // Generate a JWT token for authentication
    const studentToken = jwt.sign(
      { id: student.student_id },
      "student jwt secret key"
    );

    // Set the token as a cookie with a 7-day expiration
    res.cookie("studentToken", studentToken, {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Return the token in the response
    res.json({ studentToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
/*-----------------------------------------END OF ROUTE-------------------------------------------------- */

/*===========================GET ROUTE TO RENDER STUDENT DASHBOARD==============*/
router.get(
  "/dashboard",
  setCacheControlHeaders,
  authenticateUser,
  async (req, res) => {
    try {
      const { id } = req.user;
      const student = await Student.findOne({ student_id: id });

      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      const availableCourses = await Course.find().lean();

      const courseCodes = student.courses;

      const courses = await Course.find({ course_code: { $in: courseCodes } });

      // Populate the availableCourses array with registration status
      const coursesWithRegistrationStatus = availableCourses.map((course) => {
        course.isRegistered = courseCodes.includes(course.course_code);
        return course;
      });

      const attendanceRecords = await Attendance.find({ student_id: id });

      res.render("studentDashboard", {
        student,
        courses,
        availableCourses: coursesWithRegistrationStatus, // Use the updated array
        attendanceRecords,
      });
    } catch (error) {
      console.error("Error showing student dashboard:", error);
      res.status(500).json({
        error: "An error occurred while showing the student dashboard",
      });
    }
  }
);

/*==============================POST ROUTE TO REGISTER COURSES==================== */
router.post("/register-courses", authenticateUser, async (req, res) => {
  try {
    const studentID = req.user.id;
    const { courseCodes } = req.body;

    // Loop through the selected course codes and register the student for each course
    for (const courseCode of courseCodes) {
      // Check if the student is already registered for the course
      const student = await Student.findOne({
        student_id: studentID,
        courses: courseCode,
      });
      if (student) {
        continue; // Student is already registered, skip this course
      }

      // Register the student for the course
      await Student.findOneAndUpdate(
        { student_id: studentID },
        { $push: { courses: courseCode } }
      );
    }

    // Redirect back to the student dashboard after registration
    res.redirect("/students/dashboard");
  } catch (error) {
    console.error("Error registering courses:", error);
    res.status(500).json({
      error: "An error occurred while registering courses",
    });
  }
});

/*------------------------------------END OF ROUTE-------------------------------------------------------- */

/*===========================================DiSPLAY USER REGISTED COURSE ======== */
router.get(
  "/courses",
  setCacheControlHeaders,
  authenticateUser,
  asyncHandler(async (req, res) => {
    const { currentUser } = req;
    const courses = currentUser.courses;
    res.render("courses", { courses });
  })
);
/*-----------------------------------------END OF ROUTE---------------------------------- */

/*========================================DISPLAY USER PROFILE===================*/
router.get(
  "/profile",
  setCacheControlHeaders,
  authenticateUser,
  asyncHandler(async (req, res) => {
    const { currentUser } = req;
    res.render("profile", { user: currentUser });
  })
);
/*---------------------------------------END OF ROUTE------------------------------ */

/*============================POST ROUTE LOGOUT====================================*/
router.post("/logout", (req, res) => {
  // Clear the JWT token by setting an expired date
  res.clearCookie("token", { path: "/" });
  res.redirect("/students/login").sendStatus(200);
});
/*---------------------------------END OF ROUTE----------------------------------- */

/*======================GET ROUTE TO REGISTER COURSES===========================*/
// router.get(
//   "/register-courses",
//   setCacheControlHeaders,
//   authenticateUser,
//   asyncHandler(async (req, res) => {
//     const courses = await Course.find();
//     res.render("registerCourses", { courses });
//   })
// );
/*--------------------------END OF ROUTE-------------------------------------- */

/*===================================POST ROUTE TO REGISTER COURSES===================== */
router.post(
  "/register-courses",
  setCacheControlHeaders,
  authenticateUser,
  asyncHandler(async (req, res) => {
    const { courseCodes } = req.body;

    let notFoundCourses = [];

    for (const courseCode of courseCodes) {
      const course = await Course.findOne({ courseCode });

      if (!course) {
        console.log(`Course with code ${courseCode} not found`);
        notFoundCourses.push(courseCode);
      }
    }

    if (notFoundCourses.length > 0) {
      res
        .status(404)
        .json({ message: "Courses not found", courseCodes: notFoundCourses });
    } else {
      const { id } = req.user;
      const student = await Student.findById(id);

      for (const courseCode of courseCodes) {
        const course = await Course.findOne({ courseCode });

        const isRegistered = student.courses.some((courseId) =>
          courseId.equals(course._id)
        );
        if (isRegistered) {
          console.log(
            `Student is already registered for the course with code ${courseCode}`
          );
        } else {
          student.courses.push(course);
        }
      }

      await student.save();

      res.status(200).json({ message: "Courses registered successfully" });
    }
  })
);
/*-------------------------------------END OF ROUTE-------------------------------------------------*/

/*==================================ROUTE TO ADD NEW STUDENT========================================= */
router.post("/add", async (req, res) => {
  try {
    const { fName, lName, student_id, email, password, username, courses } =
      req.body;

    // Check if student with the same student_id or email already exists
    const existingStudent = await Student.findOne({
      $or: [{ student_id }, { email }],
    });
    if (existingStudent) {
      return res
        .status(400)
        .json({ error: "Student with the same ID or email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // Create a new student
    const newStudent = new Student({
      fName,
      lName,
      student_id,
      email,
      password: hashedPassword,
      username,
      courses: courses, // Set the courses the student is registered for
      // Add other fields here
    });

    // Save the student to the database
    await newStudent.save();

    res.status(201).json({ message: "Student added successfully" });
  } catch (error) {
    console.error("Error adding student:", error);
    res
      .status(500)
      .json({ error: "An error occurred while adding the student" });
  }
});
/*--------------------------------------END OF ROUTE----------------------------------------- */

module.exports = router;
