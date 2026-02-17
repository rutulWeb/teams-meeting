const { createGraphClient } = require("../auth/graphAuth");

class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

function toIsoDateTime(value, fieldName) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, `${fieldName} must be a valid date/time`);
  }
  return date.toISOString();
}

function validateMeetingInput(payload) {
  const { subject, startDateTime, endDateTime } = payload;
  const organizerUserId = process.env.DEFAULT_ORGANIZER_USER_ID;
  const organizerEmail = process.env.DEFAULT_ORGANIZER_EMAIL;

  if (!subject || typeof subject !== "string" || !subject.trim()) {
    throw new ApiError(400, "subject is required");
  }

  const normalizedUserId = typeof organizerUserId === "string" ? organizerUserId.trim() : "";
  const normalizedEmail = typeof organizerEmail === "string" ? organizerEmail.trim() : "";

  if (!normalizedUserId && !normalizedEmail) {
    throw new ApiError(
      500,
      "Neither DEFAULT_ORGANIZER_USER_ID nor DEFAULT_ORGANIZER_EMAIL is configured"
    );
  }
  if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new ApiError(500, "DEFAULT_ORGANIZER_EMAIL must be a valid email address");
  }

  const normalizedStart = toIsoDateTime(startDateTime, "startDateTime");
  const normalizedEnd = toIsoDateTime(endDateTime, "endDateTime");

  if (new Date(normalizedEnd) <= new Date(normalizedStart)) {
    throw new ApiError(400, "endDateTime must be after startDateTime");
  }

  return {
    subject: subject.trim(),
    organizerId: normalizedUserId || normalizedEmail,
    organizer: normalizedEmail || normalizedUserId,
    startDateTime: normalizedStart,
    endDateTime: normalizedEnd,
  };
}

function mapGraphError(error) {
  const rawMessage = error?.body?.error?.message || error?.message || "Unknown Graph API error";
  const code = error?.body?.error?.code;

  if (code === "AuthenticationError" || /invalid|token|auth/i.test(rawMessage)) {
    return new ApiError(401, "Authentication with Microsoft Graph failed", rawMessage);
  }

  if (/insufficient|permission|consent|forbidden/i.test(rawMessage) || error?.statusCode === 403) {
    return new ApiError(
      403,
      "Microsoft Graph permissions are missing. Ensure OnlineMeetings.ReadWrite.All is granted with admin consent.",
      rawMessage
    );
  }

  if (error?.statusCode === 429) {
    return new ApiError(429, "Microsoft Graph rate limit exceeded. Please retry shortly.", rawMessage);
  }

  const status = Number(error?.statusCode);
  const safeStatus = Number.isInteger(status) && status >= 100 && status <= 599 ? status : 502;
  return new ApiError(safeStatus, "Failed to create Teams meeting", rawMessage);
}

async function createOnlineMeeting(payload) {
  const input = validateMeetingInput(payload);
  const client = createGraphClient();

  try {
    const meeting = await client.api(`/users/${input.organizerId}/onlineMeetings`).post({
      subject: input.subject,
      startDateTime: input.startDateTime,
      endDateTime: input.endDateTime,
      // Request open meeting defaults; tenant policies may still enforce stricter rules.
      lobbyBypassSettings: {
        scope: "everyone",
        isDialInBypassEnabled: true,
      },
      allowedPresenters: "everyone",
    });

    return {
      meetingId: meeting.id,
      subject: meeting.subject,
      startDateTime: meeting.startDateTime,
      endDateTime: meeting.endDateTime,
      joinUrl: meeting.joinWebUrl,
      organizer: input.organizer,
    };
  } catch (error) {
    throw mapGraphError(error);
  }
}

module.exports = {
  ApiError,
  createOnlineMeeting,
};
