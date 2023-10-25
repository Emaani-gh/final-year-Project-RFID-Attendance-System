const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
  course_code: {
    type: String,
    required: true,
    unique: true,
  },
  course_name: {
    type: String,
    required: true,
  },
  lecturer_id: {
    type: String,
    ref: "Lecturer",
    required: true,
  },
  students: [{ type: String, ref: "Student" }],
});

module.exports = mongoose.model("Course", courseSchema);
