import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status"
import { appointmentServices } from "./appointment.service";

const bookAppointment = catchAsync(async (req: Request, res: Response) => {
   const result = await appointmentServices.bookAppointmentService() 
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "User profile fetched successfully",
        data: result,
    });
});

const bookAppointmentCallback = catchAsync(async (req: Request, res: Response) => {
   const result = await appointmentServices.bookAppointmentCallback() 
    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "User profile fetched successfully",
        data: result,
    });
});

export const appointmentController = {
    bookAppointment,
    bookAppointmentCallback
}