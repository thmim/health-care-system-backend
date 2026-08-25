import { Cloudinary } from "../../lib/cloudinary"
import { prisma } from "../../lib/prisma";

const uploadProfileImageService = async(buffer:Buffer,userId:string)=>{
    console.log(userId)
    Cloudinary.uploader.upload_stream(
        {
            resource_type:"auto"
        },
        async (error,result) => {
          if (error){
            console.log(error.message);
            throw new Error ("file upload failed")
          }
        //   console.log(result,"res")
          const updatedUser = await prisma.user.update({
                where : {
                    id : userId
                },

                data: {
                    imageUrl : result?.secure_url,
                    imagePublicId : result?.public_id
                }
            })

            console.log(updatedUser);
        }

    ).end(buffer);

}

export const userServices = {
    uploadProfileImageService
}