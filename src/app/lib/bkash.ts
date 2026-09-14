import config from "../config"
import { redisClient } from "./redis"

export const getBkashIdToken = async ()=>{
    
   try {
    const redisIdTokenKey="bkash:idToken"
    const redisRefreshTokenKey="bkash:refreshToken"

    let redisIdToken = await redisClient.get(redisIdTokenKey);
    const redisIdTokenTtl = await redisClient.ttl(redisIdTokenKey)
    const redisRefreshToken = await redisClient.get(redisIdTokenKey);
    const redisRefreshTokenTtl = await redisClient.ttl(redisRefreshTokenKey)

    if(redisIdTokenTtl > 600){
        return redisIdToken;
    }

    if((redisIdTokenTtl <=600 || !redisIdToken) && redisRefreshToken && redisRefreshTokenTtl > 600){

        const refreshTokenResponse = await fetch(`${config.bkash_sandbox_base_url}/tokenized/checkout/token/refresh`,{
    method:"POST",
    headers:{
        "Content-Type":"application/json",
        Accept:"application/json",
        username: config.bkash_username,
        password: config.bkash_password

    },
    body:JSON.stringify({
        app_key: config.bkash_app_key,
        app_secret: config.bkash_app_secret,
        refresh_token:redisRefreshToken
    })
   })

   if(!refreshTokenResponse.ok){
     throw new Error("Bkash Access Token Grant Failed")
   }

     const refreshTokenResult = await refreshTokenResponse.json();
     redisIdToken = refreshTokenResult.id_token as string;
     //    set id token in redis
   await redisClient.set(redisIdTokenKey,redisIdToken,{
    expiration:{
        type:"EX",
        value:3600
    }
   })

   return redisIdToken;


    }

    const response = await fetch(`${config.bkash_sandbox_base_url}/tokenized/checkout/token/grant`,{
    method:"POST",
    headers:{
        "Content-Type":"application/json",
        Accept:"application/json",
        username: config.bkash_username,
        password: config.bkash_password

    },
    body:JSON.stringify({
        app_key: config.bkash_app_key,
        app_secret: config.bkash_app_secret
    })
   })

   if(!response.ok){
    throw new Error("Id token grant failed")
   }
   const result = await response.json();
    redisIdToken = result.id_token as string;
   const refreshToken = result.refresh_token;
   
//    set id token in redis
   await redisClient.set(redisIdTokenKey,redisIdToken,{
    expiration:{
        type:"EX",
        value:3600
    }
   })

   //    set refresh token in redis
   await redisClient.set(redisRefreshTokenKey,refreshToken,{
    expiration:{
        type:"EX",
        value:60*60*24*28
    }
   })

   return redisIdToken;
    
   } catch (error:any) {
    console.log(error)
    throw new Error(error.message)
   }
}