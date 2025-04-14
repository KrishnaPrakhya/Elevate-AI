import { Description } from "@radix-ui/react-dialog"
import { z } from "zod"

export const onBoardingSchema = z.object({
  industry: z.string({
    required_error: "Please select an industry",
  }),
  subIndustry: z.string({
    required_error: "Please select a specialization",
  }),
  bio: z.string().max(500).optional(),
  experience: z
    .string()
    .transform((val) => Number.parseInt(val, 10))
    .pipe(z.number().min(0, "Experience must be at least 0 years").max(50, "Experience cannot exceed 50 years")),
  skills: z.string().transform((val) =>
    val
      ? val
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean)
      : undefined,
  ),
})


export const contactSchema=z.object({
  email:z.string().email("Invalid Email Adress"),
  mobile:z.string().optional(),
  linkedin:z.string().optional(),
  twitter:z.string().optional()
})

export const entrySchema=z.object({
  title:z.string().min(1,"Title is Required"),
  company:z.string().min(1,"Organization is Required"),
  startDate:z.string().min(1,"Start Date is Required"),
  endDate:z.string().optional(),
  description:z.string().min(1,"Please Enter Some Desciption"),
  current:z.boolean().default(false),
})
.refine(
  (data) => {
    return data.current || (!!data.endDate && data.endDate.trim().length > 0);
  },
  {
    message: "End date is required unless this is your current position",
    path: ["endDate"],
  }
)

export const resumeSchema=z.object({
  contactInfo:contactSchema,
  summary:z.string().min(1,"Professional Summary is Required"),
  skills:z.string().min(1,"Skills are required"),
  experience:z.array(entrySchema),
  education:z.array(entrySchema),
  projects:z.array(entrySchema)
})

export const coverLetterSchema=z.object({
  companyName:z.string().min(1,"Company Name is Required"),
  jobTitle:z.string().min(1,"Job Title is Required"),
  jobDescription:z.string().min(1,"Job Description is Required")
})
export type TCoverLetterSchema= z.infer<typeof coverLetterSchema>;