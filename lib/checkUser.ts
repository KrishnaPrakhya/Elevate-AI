import { currentUser } from "@clerk/nextjs/server";
import { db } from "./prisma";

export const checkUser=async()=>{
  const user =await currentUser();

  if(!user)
    return null;
  try {
    const loggedUser=await db.user.findUnique({
      where:{
        clerkUserId:user.id
      }
    })
    if(loggedUser) return loggedUser

    const name=`${user.firstName} ${user.lastName}`
    await db.user.create({
      data:{
        clerkUserId:user.id,
        name,
        imageUrl:user.imageUrl,
        email:user.emailAddresses[0].emailAddress
      }
    })
  } catch (error) {
    console.log(error);
  }
}