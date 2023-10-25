const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  student_id: {
    type: String,
    ref: "Student",
    required: true,
  },
  course_id: {
    type: String,
    ref: "Course",
    required: true,
  },
  week_number: {
    type: Number,
    required: true,
  },
  attendance_status: {
    type: String,
    required: true,
  },
  date: { type: Date, required: true },
});

module.exports = mongoose.model("Attendance", attendanceSchema);
