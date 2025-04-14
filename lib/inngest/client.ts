import { Inngest } from "inngest";

export const inngest=new Inngest({id:"elevateAi",name:"elevate-ai",
credentials:{
  gemini:{
    apiKey:process.env.GEMINI_API_KEY
  }
}
})