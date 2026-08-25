import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import httpStatus from "http-status";
import { sendResponse } from "../../utils/sendResponse";
import { userServices } from "./user.service";

const uploadUserProfileImage = catchAsync(async (req: Request, res: Response) => {
	if(!req.file){
		throw new Error("Invalid file")
	}
	const buffer = req.file?.buffer
	const userId = req.user?.userId
   await userServices.uploadProfileImageService(buffer,userId!)
	
	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Image Upload successfully",
		data: null,
	});
});

export const userController = {
    uploadUserProfileImage,
}