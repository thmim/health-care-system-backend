import z from "zod"
import { catchAsync } from "../utils/catchAsync"
import { NextFunction, Request, Response } from "express"

export const UserRequestValidation =(zodSchema:z.ZodObject)=>{
    return catchAsync(
        (req:Request,res:Response,next:NextFunction)=>{
      try {
        const payload = req.body ? req.body : {}
      const result = zodSchema.safeParse(payload)
      if(!result.success){
        console.log(result.error)
        console.log(result.error.issues)
    throw new Error(result.error.issues[0].message)
           }

           req.body = result.data
console.log(req.body)
        next()
      } catch (error) {
        console.log(error)
        next(error)
      }


     }
    )
}