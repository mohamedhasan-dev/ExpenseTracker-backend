import "dotenv/config";
import express, { type Express } from "express";
import { drizzle } from "drizzle-orm/neon-http";
import { users } from "./db/schema";
import { neon } from "@neondatabase/serverless";
import router from "./routes/auth.js";
import usersRouter from "./routes/users";

const app: Express = express();
const sql = neon(process.env.DATABASE_URL as string);
export const db = drizzle({client: sql});
const PORT = process.env.PORT || 3000;

const jwt = process.env.JWT_SECRET;
if (!jwt) {
  throw new Error("JWT_SECRET is not defined in the environment variables.");
}

app.use(express.json())
app.use('/',router)
app.use('/signup',router)
app.use('/users',usersRouter)

app.get("/", (_, res) => {
  res.send("Hello World!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
