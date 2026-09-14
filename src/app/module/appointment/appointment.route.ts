import { Router } from "express";
import { appointmentController } from "./appointment.controller";


const router = Router();
router.post("/book-appointment",appointmentController.bookAppointment)

// appointment callback url
router.get("/book-appointment/payment/callback",appointmentController.bookAppointmentCallback)


export const AppointmentRoutes = router;