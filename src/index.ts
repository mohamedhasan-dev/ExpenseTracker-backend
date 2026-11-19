import "dotenv/config";
import express, { type Express } from "express";
import cors from "cors";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

// Routers
import authRouter from "./routes/auth";
import transactionsRouter from "./routes/transactions";
import usersRouter from "./routes/users";
import categoriesRouter from "./routes/category";

const app: Express = express();
const sql = neon(process.env.DATABASE_URL as string);
export const db = drizzle({ client: sql });
const PORT = process.env.PORT || 5001;

const jwt = process.env.JWT_SECRET;
if (!jwt) {
  throw new Error("JWT_SECRET is not defined in the environment variables.");
}

app.use(cors());
app.use(express.json());

app.use("/", authRouter);
app.use("/users", usersRouter);
app.use("/transactions", transactionsRouter);
app.use("/categories", categoriesRouter);

app.get("/", (_, res) => {
  res.send("Hello World!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
