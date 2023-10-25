var express = require("express");
const jwt = require("jsonwebtoken");
const Student = require("../models/students");
const bcrypt = require("bcrypt");
var router = express.Router();

/* GET home page. */
// router.get('/', function(req, res, next) {
//   res.render('index', { title: 'Express' });
// });
/*========================GET ROUTE to RENDER THE LOGIN PAGE*/
router.get("/login", async (req, res) => {
  res.render("signIn");
});

/*=====================GET ROUTE TO HANDLE USER LOG IN================*/
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
    const token = jwt.sign({ id: student._id }, "jwt secret key");

    // Set the token as a cookie with a 7-day expiration
    res.cookie("token", token, {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Return the token in the response
    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
