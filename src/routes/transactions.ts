import { Router } from "express";
import { db } from "../index";
import { transactions } from "../db/schema";
import authMiddleware, {
  AuthenticatedRequest,
} from "../middleware/authMiddleWare";
import { eq } from "drizzle-orm";

const transactionsRouter = Router();

// Get all transactions
transactionsRouter.get(
  "/",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    console.log("Get Transactions Route Accessed");
    try {
      if (!req.user?.userId) {
        return res.status(500).json({ message: "Internal Server Error" });
      }
      const Transactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, req.user.userId));
      res.status(200).json(Transactions);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error fetching transactions" });
    }
  },
);

// Create a new transaction

transactionsRouter.post(
  "/",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    console.log("Create Transaction Route Accessed");
    try {
      if (!req.user?.userId) {
        return res.status(500).json({ message: "Internal Server Error" });
      }
      const { amount, description, type, date } = req.body;
      const userId = req.user.userId;
      if (
        typeof amount !== "number" ||
        amount <= 0 ||
        typeof description !== "string" ||
        description.trim() === "" ||
        typeof type !== "string" ||
        type.trim() === "" ||
        typeof date !== "string" ||
        date.trim() === ""
      ) {
        return res.status(400).json({
          message: "Invalid input",
        });
      }
      if (
        typeof amount !== "number" ||
        amount <= 0 ||
        typeof description !== "string" ||
        description.trim() === "" ||
        typeof type !== "string" ||
        type.trim() === "" ||
        typeof date !== "string" ||
        date.trim() === ""
      ) {
        return res.status(400).json({
          message: "Invalid input",
        });
      }

      const [newTransaction] = await db
        .insert(transactions)
        .values({
          userId,
          amount: amount.toString(),
          description,
          type:type.toLowerCase(),
          date,
        })
        .returning();
      res.status(201).json(newTransaction);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error creating transaction" });
    }
  },
);


export default transactionsRouter;