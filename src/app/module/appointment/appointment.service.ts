import { AppointmentStatus } from "../../../generated/prisma/enums";
import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";
import { prisma } from "../../lib/prisma";
import { RequestUser } from "../../middleware/checkAuth";

const bookAppointmentService = async (payload:any,user:RequestUser) => {

    const transactionResult = await prisma.$transaction(async(tx)=>{
        const appointment = await tx.appointments.create({
            data:{
                status: AppointmentStatus.PENDING,
            }
           
        })

        // create payment

         const bkashIdToken = await getBkashIdToken();

    if(!bkashIdToken){
         throw new Error("No Bkash Access Token Found!")
    }
    console.log(bkashIdToken)

    const bkshPaymentCreateResponse = await fetch(`${config.bkash_sandbox_base_url}/tokenized/checkout/create`,{
        method:"POST",
            headers:{
                "Content-Type":"application/json",
                Accept:"application/json",
                Authorization: bkashIdToken,
                "X-App-Key": config.bkash_app_key
        
            },
            body:JSON.stringify({
                 mode: "0011",  // mode 0011 use korbo not 0001
            payerReference: user.email, //user email or phone number
            callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,  // appointment book korar callback url
            amount: "1200",
            currency: "BDT",
            intent: "sale",
            // merchantInvoiceNumber: "Inv4" (apppointment id)
            merchantInvoiceNumber:appointment.id
            })
    })

    const bkashPaymentCreateResult = await bkshPaymentCreateResponse.json();
    console.log({bkashPaymentCreateResult});

    //paymen model create

		await tx.payments.create({
			data: {
				merchantInvoiceNumber: bkashPaymentCreateResult.merchantInvoiceNumber,
				appointmentId: appointment.id,
				amount: "1200",
				gatewayResponse: bkashPaymentCreateResult,
				bkashPaymentId: bkashPaymentCreateResult.paymentID,
				payerReference: user.email,
			},
		});
        return {
			paymentUrl: bkashPaymentCreateResult.bkashURL,
		};
    })

    return transactionResult;
   
	
};

const bookAppointmentCallback = async (query:Record<string,any>) => {

    // Record<string,any> this is a typescript type. it means একটা object, যার key হবে string এবং value যেকোনো type-এর হতে পারে।

     const paymentId = query.paymentID

    if(!paymentId){
        throw new Error("Payment Id Missing")
    }

    const status = query.status

    if(!status){
        throw new Error("Payment Status is Missing")
    }

    const bkashIdToken = await getBkashIdToken();

    if (!bkashIdToken) {
        throw new Error("No Bkash Access Token Found!")
    }

    const executedPaymentResponse = await fetch(`${config.bkash_sandbox_base_url}/tokenized/checkout/execute`, {
        method : "POST",
        headers : {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: bkashIdToken,
            "X-App-Key": config.bkash_app_key
        },

        body : JSON.stringify({
            paymentID : paymentId
        })
    })

    const executedPaymentResult = await executedPaymentResponse.json()
   
    if(status === "success"){
        return {
            executedPaymentResult,
            redirectUrl : `${config.frontend_url}/dashboard/my-appointments?status=success`
        }
    }
    if(status === "failure"){
        return {
            executedPaymentResult,
            redirectUrl : `${config.frontend_url}/dashboard/my-appointments?status=failue`
        }
    }
    if(status === "cancel"){
        return {
            executedPaymentResult,
            redirectUrl : `${config.frontend_url}/dashboard/my-appointments?status=cancel`
        }
    }

    return {
        executedPaymentResult,
        redirectUrl: `${config.frontend_url}/dashboard/my-appointments`
    }
};

export const appointmentServices = {
    bookAppointmentService,
    bookAppointmentCallback
}