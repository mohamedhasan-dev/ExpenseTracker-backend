import { Router } from "express";
import { db } from "../index";
import { categories, transactions } from "../db/schema";
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

      const { amount, description, type, date, categoryId, paymentMethod } =
        req.body;

      // 1. AMOUNT: Finite, positive, and fits within DECIMAL(10,2) (max 99,999,999.99)
      if (
        typeof amount !== "number" ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > 99999999.99
      ) {
        return res.status(400).json({
          message:
            "Invalid amount. Must be a positive finite number under 100 million.",
        });
      }

      // 2. DESCRIPTION: Optional, but if provided must be a string under 255 chars
      if (
        description !== undefined &&
        (typeof description !== "string" || description.length > 255)
      ) {
        return res.status(400).json({
          message: "Invalid description. Must be text under 255 characters.",
        });
      }

      // 3. TYPE: Strictly limited to supported values
      if (!["Expense", "Income"].includes(type)) {
        return res.status(400).json({
          message: "Invalid type. Must be 'Expense' or 'Income'.",
        });
      }

      // 4. DATE: Must be a valid, parseable string (like an ISO string)
      const parsedDate = Date.parse(date);
      if (typeof date !== "string" || isNaN(parsedDate)) {
        return res.status(400).json({
          message: "Invalid date format. Expected a valid timestamp string.",
        });
      }

      // 5. PAYMENT METHOD: Strictly limited to the frontend UI options
      const supportedMethods = ["UPI", "Card", "Cash", "Bank"];
      if (!supportedMethods.includes(paymentMethod)) {
        return res.status(400).json({
          message: `Invalid payment method. Supported methods: ${supportedMethods.join(", ")}.`,
        });
      }

      // 6. CATEGORY ID FORMAT: Ensure it is a valid UUID string to prevent malformed queries
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (typeof categoryId !== "string" || !uuidRegex.test(categoryId)) {
        return res.status(400).json({
          message: "Invalid category ID format. Expected a UUID.",
        });
      }

      // 7. CATEGORY ACCESS: Ensure the UUID actually exists and belongs to the user or is a global default
      const validCategory = await db
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.id, categoryId),
            or(isNull(categories.userId), eq(categories.userId, userId)),
          ),
        )
        .limit(1);

      if (validCategory.length === 0) {
        return res
          .status(403)
          .json({ message: "Invalid or unauthorized category" });
      }

      // 8. DATABASE INSERTION: Safe to execute
      const [newTransaction] = await db
        .insert(transactions)
        .values({
          userId,
          categoryId,
          paymentMethod,
          amount: amount.toString(), // Drizzle expects a string for decimal columns
          description: description?.trim() || null,
          type,
          date: new Date(parsedDate), // Use the already validated parsed date
        })
        .returning();

      res.status(201).json(newTransaction);
    } catch (error) {
      console.error("Error creating transaction:", error);
      res.status(500).json({ message: "Error creating transaction" });
    }
  },
);
export default transactionsRouter;
