import z from "zod";

const PatientRegisterZodSchema = z.object({
	name:z.string(),
	email:z.email(),
	password:z.string().min(8, "Password Must Minimum 8 Characters Long.")
        .regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
        .regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")

        .regex(/[0-9]/, "Password must contain atleast 1 Number")
        .regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
	patientData:z.object({
		contactNumber:z.string().optional()
	}).optional()
})

// login schema
const PatientLoginZodSchema = z.object({
	email:z.email(),
	password:z.string().min(8, "Password Must Minimum 8 Characters Long.")
        .regex(/[a-z]/, "Password must contain atleast 1 Lowercase Letter")
        .regex(/[A-Z]/, "Password must contain atleast 1 Uppercase Letter")

        .regex(/[0-9]/, "Password must contain atleast 1 Number")
        .regex(/[^A-Za-z0-9]/, "Password must contain atleast 1 Special Character"),
	
})

export const patientValidation = {
    PatientRegisterZodSchema,
	PatientLoginZodSchema
}