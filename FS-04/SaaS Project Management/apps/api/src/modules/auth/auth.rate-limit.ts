import { rateLimit } from "express-rate-limit";

function createAuthRateLimiter(limit: number, windowMs: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_request, response) => {
      response.status(429).json({
        error: {
          code: "TOO_MANY_AUTH_ATTEMPTS",
          message: "Too many authentication attempts. Please try again later.",
        },
      });
    },
  });
}

export const registrationRateLimiter = createAuthRateLimiter(5, 60 * 60 * 1000);
export const loginRateLimiter = createAuthRateLimiter(10, 15 * 60 * 1000);
