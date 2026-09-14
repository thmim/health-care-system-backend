import config from "../../config";
import { getBkashIdToken } from "../../lib/bkash";

const bookAppointmentService = async () => {
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
            payerReference: "0123456789", //user email or phone number
            callbackURL: `${config.bkash_callback_url}/appointment/book-appointment/payment/callback`,  // appointment book korar callback url
            amount: "1200",
            currency: "BDT",
            intent: "sale",
            merchantInvoiceNumber: "Inv4" // apppointment id
            })
    })

    const bkashPaymentCreateResult = await bkshPaymentCreateResponse.json();
    console.log({bkashPaymentCreateResult});

    return bkashPaymentCreateResult;
	
};

const bookAppointmentCallback = () => {
   
    return {
        success:true
    }
};

export const appointmentServices = {
    bookAppointmentService,
    bookAppointmentCallback
}