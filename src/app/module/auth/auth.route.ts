import { NextFunction, Request, Response, Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { AuthController } from "./auth.controller";
import { patientValidation } from "./auth.validation";
import { catchAsync } from "../../utils/catchAsync";
import z from "zod";
import { UserRequestValidation } from "../../middleware/requestValidation";

const router = Router();

router.post("/register", UserRequestValidation(patientValidation.PatientRegisterZodSchema),AuthController.registerPatient);

router.post("/verify-email", AuthController.verifyEmail);

router.post("/login",UserRequestValidation(patientValidation.PatientLoginZodSchema), AuthController.loginUser);

// google login
router.post("/google",AuthController.googleLoginController);
router.get(
	"/me",
	auth(Role.ADMIN, Role.DOCTOR, Role.PATIENT, Role.SUPER_ADMIN),
	AuthController.getMe,
);

router.post("/refresh-token", AuthController.refreshToken);

router.post("/forgot-password", AuthController.forgotPasswordController);
router.post("/reset-password", AuthController.resetPasswordController);

export const AuthRoutes = router;
