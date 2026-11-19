import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { getCurrentUser, login, logout, register } from "./auth.controller.js";
import { loginRateLimiter, registrationRateLimiter } from "./auth.rate-limit.js";
import { loginSchema, registerSchema } from "./auth.schemas.js";

export const authRouter = Router();

authRouter.post("/register", registrationRateLimiter, validateRequest({ body: registerSchema }), register);
authRouter.post("/login", loginRateLimiter, validateRequest({ body: loginSchema }), login);
authRouter.post("/logout", logout);
authRouter.get("/me", authenticate, getCurrentUser);
