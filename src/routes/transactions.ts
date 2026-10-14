import { Router } from "express";
import { db } from "../index";
import { transactions } from "../db/schema";
import authMiddleware, {
  AuthenticatedRequest,
} from "../middleware/authMiddleWare";
import { eq, or, isNull, and } from "drizzle-orm";

const transactionsRouter = Router();

// Get all transactions
transactionsRouter.get(
  "/",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    console.log("Get Transactions Route Accessed");
    try {
      if (!req.user?.userId) {
        return res.status(401).json({ message: "Unauthorized" });
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
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      // Expecting categoryId (UUID) from the frontend
      const { amount, description, type, date, categoryId, paymentMethod } =
        req.body;

      // Basic type validation...
      if (!categoryId || typeof categoryId !== "string") {
        return res.status(400).json({ message: "Invalid category" });
      }

      // Single, lightning-fast database insertion
      const [newTransaction] = await db
        .insert(transactions)
        .values({
          userId,
          categoryId, // Maps directly to the foreign key
          paymentMethod,
          amount: amount.toString(),
          description,
          type,
          date: new Date(date),
        })
        .returning();

      res.status(201).json(newTransaction);
    } catch (error) {
      // If the frontend sends a UUID that doesn't exist in the categories table,
      // Postgres will throw a Foreign Key Violation error here.
      console.error(error);
      res.status(500).json({ message: "Error creating transaction" });
    }
  },
);
export default transactionsRouter;
