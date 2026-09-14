import { UploadApiResponse } from "cloudinary";
import { Cloudinary } from "../../lib/cloudinary"
import { prisma } from "../../lib/prisma";

const uploadProfileImageService = async(buffer:Buffer,userId:string)=>{

    // get current user data
      const currentUser = await prisma.user.findUnique({
        where: {
            id: userId
        },
        select: {
            imagePublicId: true,
            imageUrl: true
        }
    })

   
//   Cloudinary.uploader.upload_stream(
//         {
//             resource_type:"auto"
//         },
//         async (error,result) => {
//           if (error){
//             console.log(error.message);
//             throw new Error ("file upload failed")
//           }
//         //   console.log(result,"res")
//           const updatedUser = await prisma.user.update({
//                 where : {
//                     id : userId
//                 },

//                 data: {
//                     imageUrl : result?.secure_url,
//                     imagePublicId : result?.public_id
//                 }
//             })

            
//         }

//     ).end(buffer);

 const cloudinaryResult = await new Promise<UploadApiResponse>((resolve, reject) => {
        Cloudinary.uploader.upload_stream(
            {
                resource_type: "auto"
            },

            async (error, result) => {
                if (error) {
                    return reject(error);
                }

                if(!result){
                    return reject(new Error("No result returned from Cloudinary"));
                }

                resolve(result);
            }
        ).end(buffer)
    })

    // user update here

        const updatedUser = await prisma.user.update({
        where: {
            id: userId
        },

        data: {
            imageUrl: cloudinaryResult.secure_url,
            imagePublicId: cloudinaryResult.public_id
        },

        omit:{
            password : true
        }
    })

    if(currentUser?.imagePublicId && currentUser.imageUrl){
        await Cloudinary.uploader.destroy(currentUser.imagePublicId)
    }


    return updatedUser

}

export const userServices = {
    uploadProfileImageService
}