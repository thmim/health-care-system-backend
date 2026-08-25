import bcrypt from "bcryptjs";
import type { JwtPayload, SignOptions } from "jsonwebtoken";
import { AuthProvider, Role, UserStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { prisma } from "../../lib/prisma";
import { jwtUtils } from "../../utils/jwt";
import crypto from "crypto";
import type {
	IForgotPasswordPayload,
	IGoogleLoginPayload,
	ILoginUserPayload,
	IRegisterPatientPayload,
	IRequestUser,
	IResetPasswordPayload,
	IVerifyUserPayload,
} from "./auth.interface";
import { OAuth2Client, TokenPayload } from "google-auth-library";
import { googleClient } from "../../lib/googleAuth";
import { redisClient } from "../../lib/redis";
import { transporter } from "../../lib/nodemailer";
import ejs from "ejs";
import path from "path";

const registerPatient = async (payload: IRegisterPatientPayload) => {
	const { name, password,patientData } = payload;
	const email = payload.email.trim().toLowerCase();

	const isUserExists = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExists) {
		throw new Error("User with this email already exists");
	}

	const hashedPassword = await bcrypt.hash(password, 8);

	const registerVerificationKey = `email-verification-otp:${email}`
	const otpValue = crypto.randomInt(100000,1000000);

	await redisClient.set(registerVerificationKey,otpValue,{
		expiration:{
			type:"EX",
			value:180
		}
	});

	const patientRegistrationKey = `patient-registration-data:${email}`
	const redisUserPayload = {
		name,
		email,
		password: hashedPassword,
		patient:patientData
	}

	await redisClient.set(
		patientRegistrationKey, 
		JSON.stringify(redisUserPayload), 
		{
			expiration: {
				type: "EX",
				value: 180
			}
		}
	)



	const templetePath = path.join(process.cwd(),"/src/app/templetes/register-user-otp.ejs")

	const html = await ejs.renderFile(templetePath,{
		name:name,
		email,
		otp:otpValue,
		expirationMinutes:180/60
	})

	await transporter.sendMail({
		from:config.smtp_email_sender,
		to:email,
		subject:"Verify your email",
		// html:`<h1>Your OTP is ${otp}</h1>`
		html
	})

};

const verifyEmailService = async (payload:IVerifyUserPayload)=>{
	const otp = payload.otp;
	const email = payload.email.trim().toLowerCase();

	const isUserExist = await prisma.user.findUnique({
		where:{
			email:email
		}
	})

	if(isUserExist?.emailVerified){
        throw new Error("User already verified")
	}

	if(isUserExist?.status === "BLOCKED"){
        throw new Error("User is Blocked")
	}

	if(isUserExist?.isDeleted || isUserExist?.status === "DELETED"){
		throw new Error("User is Deleted")
	}

	const registerVerificationKey = `email-verification-otp:${email}`
	const redisOtp = await redisClient.get(registerVerificationKey);

	if(!redisOtp){
		throw new Error("Invalid otp")
	}

	if (redisOtp !== otp) {
		throw new Error("OTP Does Not Match")
	}

	await redisClient.del(registerVerificationKey);

	const patientRegistrationKey = `patient-registration-data:${email}`

	const redisPatientData = await redisClient.get(patientRegistrationKey)

	if(!redisPatientData){
		throw new Error ("Patient Doesnt Exist");
	}

	const patientPayload : IRegisterPatientPayload = JSON.parse(redisPatientData)

	
   const createdUser = await prisma.user.create({
		data: {
			name:patientPayload.name,
			email,
			password: patientPayload.password,
			role: Role.PATIENT,
			status: UserStatus.ACTIVE,
			emailVerified: true,
			patient: {
				create: { name: patientPayload.name,
					email: patientPayload.email, contactNumber:patientPayload?.patientData?.contactNumber || ""},
			},
		},
		omit: { password: true },
		include: { patient: true },
	});

	await redisClient.del(patientRegistrationKey);

	const { patient, ...user } = createdUser;
	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		user,
		patient,
		accessToken,
		refreshToken,
	};

};

const loginUser = async (payload: ILoginUserPayload) => {
	const { password } = payload;
	const email = payload.email.trim().toLowerCase();

	const user = await prisma.user.findUnique({
		where: { email },
	});

	if (!user) {
		throw new Error("User not found");
	}

	if (user.status === UserStatus.BLOCKED) {
		throw new Error("User is blocked");
	}

	if (user.isDeleted || user.status === UserStatus.DELETED) {
		throw new Error("User is deleted");
	}

	const isPasswordMatched = await bcrypt.compare(password, user.password as string);

	if (!isPasswordMatched) {
		throw new Error("Invalid credentials");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const getMe = async (user: IRequestUser) => {
	const isUserExists = await prisma.user.findUnique({
		where: {
			id: user.userId,
		},
		include: {
			patient: true,
		},
		omit: {
			password: true,
		},
	});

	if (!isUserExists) {
		throw new Error("User not found");
	}

	return isUserExists;
};

const googleLoginService = async (payload:IGoogleLoginPayload) => {
	let googleIdTokenPayload:TokenPayload |null | undefined = null

	try {
		const ticket = await googleClient.verifyIdToken({
		idToken:payload.idToken,
		audience:config.google_auth_client_id
		
	})
	googleIdTokenPayload = ticket.getPayload()
		
	} catch (error) {
		console.log("Google Id Token Verification Failed",error)
		throw new Error("Invalid or Expired Token Id")
	}

	if(!googleIdTokenPayload){
		throw new Error("Invalid or Expired Token Id")
	}

	if(!googleIdTokenPayload.name){
		throw new Error("User Name not found")
	}
	if(!googleIdTokenPayload.email){
		throw new Error("User email not found")
	}

	const isPatientExistWithGoogleAuth = await prisma.user.findUnique({
		where:{
			email:googleIdTokenPayload.email,
			role:Role.PATIENT,
			googleId:googleIdTokenPayload.sub
		}
	})

	let user = isPatientExistWithGoogleAuth;
	if(!user){
user = await prisma.user.create({
	data:{
		name:googleIdTokenPayload.name,
	email:googleIdTokenPayload.email,
	role:Role.PATIENT,
	googleId:googleIdTokenPayload.sub,
	authProvider:AuthProvider.GOOGLE,
	patient:{
create:{
	name:googleIdTokenPayload.name,
	email:googleIdTokenPayload.email,
}
	}
	}
	
})
	}
	
const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};

};

// forgot password
const forgotPasswordService = async (payload:IForgotPasswordPayload) => {
	const {email} = payload;

	const isUserExist = await prisma.user.findUnique({
		where:{
			email:email
		}
	})

	if(!isUserExist){
		throw new Error("User doesn't exist with this email")
	}

	if(!isUserExist.emailVerified){
        throw new Error("User not verified")
	}

	if(isUserExist.status === "BLOCKED"){
        throw new Error("User is Blocked")
	}

	if(isUserExist.isDeleted || isUserExist.status === "DELETED"){
		throw new Error("User is Deleted")
	}

	if(isUserExist.googleId && isUserExist.authProvider === "GOOGLE"){
		throw new Error("User Has Account With Google")
	}
    
	const key = `forgot-password-otp:${isUserExist.email}`
	const otp = crypto.randomInt(100000,1000000);
	await redisClient.set(key,otp,{
		expiration:{
			type:"EX",
			value:180
		}
	});

	const templetePath = path.join(process.cwd(),"/src/app/templetes/forgot-password.ejs")
	const html = await ejs.renderFile(templetePath,{
		name:isUserExist.name,
		otp,
		expirationMinutes:180/60
	})

	await transporter.sendMail({
		from:config.smtp_email_sender,
		to:isUserExist.email,
		subject:"Reset password otp",
		// html:`<h1>Your OTP is ${otp}</h1>`
		html
	})
};

// reset password
const resetPasswordService = async (payload:IResetPasswordPayload) => {
	const {email,newPassword,otp} = payload;

	const isUserExist = await prisma.user.findUnique({
		where:{
			email:email
		}
	})

	if(!isUserExist){
		throw new Error("User doesn't exist with this email")
	}

	if(!isUserExist.emailVerified){
        throw new Error("User not verified")
	}

	if(isUserExist.status === "BLOCKED"){
        throw new Error("User is Blocked")
	}

	if(isUserExist.isDeleted || isUserExist.status === "DELETED"){
		throw new Error("User is Deleted")
	}

	if(isUserExist.googleId && isUserExist.authProvider === "GOOGLE"){
		throw new Error("User Has Account With Google")
	}
const key = `forgot-password-otp:${isUserExist.email}`
	const redisOtp = await redisClient.get(key)
	if(!redisOtp){
		throw new Error("Invalid OTP")
	}

	if(otp !== redisOtp){
		throw new Error("OTP does not matched")
	}

	const hashedNewPassword = await bcrypt.hash(newPassword,Number(config.bcrypt_salt_rounds))

	await prisma.user.update({
		where : {
			email : isUserExist.email
		},
		data : {
			password : hashedNewPassword
		}
	});

	const templetePath = path.join(process.cwd(),"/src/app/templetes/reset-password.ejs")
	const html = await ejs.renderFile(templetePath,{
		name:isUserExist.name,
		
	})

	await transporter.sendMail({
		from:config.smtp_email_sender,
		to:isUserExist.email,
		subject:"Password changed",
		// html:`<h1>Your Password changed Successfully</h1>`
		html
	})


	await redisClient.del([key]);

};

const refreshToken = async (token: string) => {
	const verifiedRefreshToken = jwtUtils.verifyToken(
		token,
		config.jwt_refresh_secret,
	);

	if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
		throw new Error(
			config.node_env === "development"
				? verifiedRefreshToken.error
				: "Invalid refresh token",
		);
	}

	const data = verifiedRefreshToken.data as JwtPayload;

	const user = await prisma.user.findUnique({
		where: { id: data.userId },
	});

	if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
		throw new Error("User is inactive or not found");
	}

	const jwtPayload = {
		userId: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

export const AuthService = {
	registerPatient,
	loginUser,
	getMe,
	refreshToken,
	googleLoginService,
	forgotPasswordService,
	resetPasswordService,
	verifyEmailService
};
