const express = require("express");
const { createOnlineMeeting } = require("../services/meetingService");

const router = express.Router();

router.post("/meetings", async (req, res, next) => {
  try {
    const meeting = await createOnlineMeeting(req.body);
    res.status(201).json(meeting);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
