"use server"

import { auth } from "@clerk/nextjs/server"

export const getClerkId=async()=>{

  const {userId}=await auth();
  return userId;
}