export function wrapAsync(handler) {
  return function wrappedRoute(req, res, next) {
    return Promise.resolve(handler(req, res, next)).catch(next);
  };
}
