const express = require("express");
const router = express.Router();
const Attendance = require("../models/attendance");

/*============================POST ROUTE TO CAPTURE STD ID AND  MARK ATTENDANCE =============================*/
router.post("/capture", async (req, res) => {
  try {
    const { textFieldValue, courseID, weekNumber } = req.body;
    const studentId = textFieldValue;

    // Parse weekNumber to an integer
    const parsedWeekNumber = parseInt(weekNumber);

    // Find the attendance document for the student, course, and week
    const attendance = await Attendance.findOne({
      student_id: studentId,
      course_id: courseID,
      week_number: parsedWeekNumber,
    });

    if (!attendance) {
      return res
        .status(404)
        .json({ error: `Attendance not initiated for ${studentId}` });
    }

    // Update the attendance record for the specified week
    attendance.attendance_status = "Present";
    attendance.date = new Date();

    await attendance.save();

    res.sendStatus(200);
  } catch (error) {
    console.error("Error marking attendance:", error);
    res
      .status(500)
      .json({ error: "An error occurred while marking attendance" });
  }
});
/*----------------------------------END OF ROUTE------------------------------------------------------------------ */

module.exports = router;
