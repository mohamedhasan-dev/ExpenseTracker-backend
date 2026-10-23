import { Router } from "express";
import { db } from "../index";
import { categories, transactions } from "../db/schema";
import authMiddleware, {
  AuthenticatedRequest,
} from "../middleware/authMiddleWare";
import { eq, or, isNull, and, gte, lt, desc, sql, type SQL } from "drizzle-orm";

const transactionsRouter = Router();

// Accepts ISO 8601 only (e.g. 2026-10-01 or 2026-10-01T00:00:00.000Z) so dates are never ambiguous
const ISO_DATE =
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const parseIsoQuery = (value: unknown): Date | null => {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time);
};

/* ---------- Monthly summary (month-over-month badges) ---------- */

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Amount from a numeric SUM (string) rounded to paise */
const toAmount = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

/**
 * ((current - previous) / previous) * 100, rounded to 1 decimal.
 * Returns null when the previous period is 0: there is no baseline to compare
 * against (and dividing by zero would give Infinity/NaN). The app hides the badge.
 */
const percentChange = (current: number, previous: number): number | null => {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};

// GET /transactions/summary?month=2026-10&tzOffset=330&compare=to-date
//   month    - YYYY-MM (optional, defaults to the current month on the user's clock)
//   tzOffset - user's UTC offset in minutes, e.g. 330 for IST (optional, defaults to 0 = UTC).
//              Needed so "October" means October in the user's time zone, not the server's.
//   compare  - "to-date" | "full" (optional). For the month in progress the default is
//              "to-date": 1st..today vs 1st..same day of last month (e.g. 1-22 Oct vs
//              1-22 Sep), so early-month numbers aren't compared with a whole month.
//              Past months always compare full months.
// Response: { month, comparison, range, previousRange, current: {income, expense},
//             previous: {income, expense}, change: {income, expense} }
//             (change values are % or null; ranges are [from, to) in UTC)
transactionsRouter.get(
  "/summary",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { month, tzOffset, compare } = req.query;

      if (compare !== undefined && compare !== "to-date" && compare !== "full") {
        return res
          .status(400)
          .json({ message: "Invalid 'compare'. Use 'to-date' or 'full'." });
      }

      let offset = 0;
      if (tzOffset !== undefined) {
        offset = Number(tzOffset);
        if (!Number.isInteger(offset) || offset < -720 || offset > 840) {
          return res.status(400).json({
            message: "Invalid 'tzOffset'. Use minutes east of UTC, e.g. 330 for IST.",
          });
        }
      }

      // "Now" on the user's clock (read with getUTC* because the offset is already applied)
      const userNow = new Date(Date.now() + offset * 60_000);

      let year: number;
      let monthIndex: number; // 0-11
      if (month !== undefined) {
        const match = typeof month === "string" ? MONTH.exec(month) : null;
        if (!match) {
          return res
            .status(400)
            .json({ message: "Invalid 'month'. Expected YYYY-MM." });
        }
        year = Number(match[1]);
        monthIndex = Number(match[2]) - 1;
      } else {
        year = userNow.getUTCFullYear();
        monthIndex = userNow.getUTCMonth();
      }

      // Local midnight of a calendar day in the user's time zone, as a UTC instant.
      // Date.UTC rolls over out-of-range months/days (month -1, day 32, ...).
      const localMidnight = (m: number, day: number) =>
        new Date(Date.UTC(year, m, day) - offset * 60_000);

      const previousStart = localMidnight(monthIndex - 1, 1);
      const currentStart = localMidnight(monthIndex, 1);
      const nextStart = localMidnight(monthIndex + 1, 1);

      const isCurrentMonth =
        year === userNow.getUTCFullYear() && monthIndex === userNow.getUTCMonth();
      const toDate = isCurrentMonth && compare !== "full";

      // Ranges are [start, end). Full months by default...
      let currentEnd = nextStart;
      let previousEnd = currentStart;
      if (toDate) {
        // ...or whole days 1..today vs 1..same day of last month
        const today = userNow.getUTCDate();
        currentEnd = localMidnight(monthIndex, today + 1); // end of today
        // Same day number last month, clamped when last month is shorter
        // (31 Oct -> all of September, 30 Mar -> all of February)
        const sameDayLastMonth = localMidnight(monthIndex - 1, today + 1);
        previousEnd =
          sameDayLastMonth < currentStart ? sameDayLastMonth : currentStart;
      }

      // Older rows were saved lower-case, so compare case-insensitively
      const isIncome = sql`lower(${transactions.type}) = 'income'`;
      const isExpense = sql`lower(${transactions.type}) = 'expense'`;
      const inCurrent = and(
        gte(transactions.date, currentStart),
        lt(transactions.date, currentEnd),
      );
      const inPrevious = and(
        gte(transactions.date, previousStart),
        lt(transactions.date, previousEnd),
      );
      const total = (condition: SQL | undefined) =>
        sql<string>`coalesce(sum(${transactions.amount}) filter (where ${condition}), 0)`;

      // One query, one table scan over both months (conditional aggregation)
      const [row] = await db
        .select({
          currentIncome: total(and(isIncome, inCurrent)),
          currentExpense: total(and(isExpense, inCurrent)),
          previousIncome: total(and(isIncome, inPrevious)),
          previousExpense: total(and(isExpense, inPrevious)),
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            gte(transactions.date, previousStart),
            lt(transactions.date, currentEnd),
          ),
        );

      const current = {
        income: toAmount(row?.currentIncome),
        expense: toAmount(row?.currentExpense),
      };
      const previous = {
        income: toAmount(row?.previousIncome),
        expense: toAmount(row?.previousExpense),
      };

      return res.status(200).json({
        month: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
        comparison: toDate ? "month-to-date" : "full-month",
        range: { from: currentStart.toISOString(), to: currentEnd.toISOString() },
        previousRange: {
          from: previousStart.toISOString(),
          to: previousEnd.toISOString(),
        },
        current,
        previous,
        change: {
          income: percentChange(current.income, previous.income),
          expense: percentChange(current.expense, previous.expense),
        },
      });
    } catch (error) {
      console.error("Error building transaction summary:", error);
      return res.status(500).json({ message: "Error building transaction summary" });
    }
  },
);

// Get the user's transactions, newest first
// Optional query params:
//   from  - ISO date/time, inclusive  (e.g. start of the month in the user's timezone)
//   to    - ISO date/time, exclusive  (e.g. start of next month)
//   limit - 1..100
transactionsRouter.get(
  "/",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    console.log("Get Transactions Route Accessed");
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { from, to, limit } = req.query;
      const conditions: SQL[] = [eq(transactions.userId, userId)];

      if (from !== undefined) {
        const fromDate = parseIsoQuery(from);
        if (!fromDate) {
          return res
            .status(400)
            .json({ message: "Invalid 'from'. Expected an ISO date." });
        }
        conditions.push(gte(transactions.date, fromDate));
      }

      if (to !== undefined) {
        const toDate = parseIsoQuery(to);
        if (!toDate) {
          return res
            .status(400)
            .json({ message: "Invalid 'to'. Expected an ISO date." });
        }
        conditions.push(lt(transactions.date, toDate));
      }

      let take: number | undefined;
      if (limit !== undefined) {
        take = Number(limit);
        if (!Number.isInteger(take) || take < 1 || take > 100) {
          return res
            .status(400)
            .json({ message: "Invalid 'limit'. Must be a whole number from 1 to 100." });
        }
      }

      const query = db
        .select({
          id: transactions.id,
          amount: transactions.amount,
          description: transactions.description,
          type: transactions.type,
          date: transactions.date,
          paymentMethod: transactions.paymentMethod,
          category: {
            id: categories.id,
            name: categories.name,
            icon: categories.icon,
          },
        })
        .from(transactions)
        .innerJoin(categories, eq(transactions.categoryId, categories.id))
        .where(and(...conditions))
        .orderBy(desc(transactions.date), desc(transactions.id))
        .$dynamic();

      const Transactions = await (take ? query.limit(take) : query);
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
