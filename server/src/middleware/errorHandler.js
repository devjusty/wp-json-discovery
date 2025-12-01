import { logSilently } from '../logger.js';
import { AppError, NetworkError, ValidationError } from '../utils/errors.js';

export function errorHandler(err, req, res, next) {
  // Determine status code
  let statusCode = 500;
  let errorName = err.name || 'Error';
  let errorMessage = err.message || 'An unexpected error occurred';
  let errorDetails = process.env.NODE_ENV === 'development' ? err.stack : undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorName = err.name;
    errorMessage = err.message;
    errorDetails = err.details || errorDetails;
  }

  // Log the error silently
  logSilently('unhandled_error', {
    name: errorName,
    message: errorMessage,
    stack: errorDetails,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  // Send error response
  res.status(statusCode).json({
    error: errorMessage,
    details: errorDetails
  });
}
