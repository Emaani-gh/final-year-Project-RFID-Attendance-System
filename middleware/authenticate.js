const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Student = require("../models/students");

exports.authenticateUser = async (req, res, next) => {
  try {
    // Get the appropriate token based on the user role
    const studentToken = req.cookies.studentToken; // Assuming you have a student-specific token
    const lecturerToken = req.cookies.lecturerToken; // Assuming you have a lecturer-specific token

    if (!studentToken && !lecturerToken) {
      // Redirect to the login page
      return res.redirect("login");
    }
    // Set cache-control headers to prevent caching
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    // Verify and decode the appropriate token based on the user role
    let decoded;
    if (studentToken) {
      decoded = jwt.verify(studentToken, "student jwt secret key");
    } else if (lecturerToken) {
      decoded = jwt.verify(lecturerToken, "lecturer jwt secret key");
    }

    // Attach the decoded user information to the request object
    req.user = decoded;
    const { id } = req.user;

    // Continue to the next middleware or route handler
    next();
  } catch (error) {
    // Display the error page with the error message
    res.render("error", { message: "Unauthorized" });
  }
};
