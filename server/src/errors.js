class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Códigos del motor y del servidor -> estado HTTP.
const STATUS_BY_CODE = {
  INVALID_INSTANCE: 400,
  INVALID_REQUEST: 400,
  UNKNOWN_ALGORITHM: 400,
  UNKNOWN_MODE: 400,
  INSTANCE_TOO_LARGE: 422,
  INTERNAL_ERROR: 500,
  ENGINE_NOT_FOUND: 503,
  ENGINE_START_FAILED: 503,
  ENGINE_CRASHED: 502,
  ENGINE_BAD_OUTPUT: 502,
  ENGINE_OUTPUT_TOO_LARGE: 502,
  ENGINE_TIMEOUT: 504,
};

function statusFor(code) {
  return STATUS_BY_CODE[code] || 500;
}

module.exports = { ApiError, statusFor };
