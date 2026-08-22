import "dotenv/config";
import express, { type Express } from "express";
import { drizzle } from "drizzle-orm/neon-http";
import { users } from "./db/schema.ts";
import { neon } from "@neondatabase/serverless";
import router from "./routes/users.ts";

const app: Express = express();
const sql = neon(process.env.DATABASE_URL as string);
export const db = drizzle({client: sql});
const PORT = process.env.PORT || 3000;

app.use(express.json())
app.use('/',router)
app.use('/signup',router)

app.get("/", (_, res) => {
  res.send("Hello World!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
