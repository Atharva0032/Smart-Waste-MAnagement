/**
 * Small typed error class carrying an HTTP status code.
 * Controllers throw `new ApiError(404, 'Complaint not found')` and the central
 * error handler converts it into a consistent JSON response.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status code to send
   * @param {string} message human readable message returned to the client
   * @param {object} [details] optional extra payload (e.g. field errors)
   */
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
