// app/quiz/types.ts
export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

// Now QuizResponse is just an array of QuizQuestion
export type QuizResponse = QuizQuestion[];

export interface User {
  industry: string;
  skills?: string[];
}