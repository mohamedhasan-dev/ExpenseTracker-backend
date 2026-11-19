import { Router } from "express";
import { db } from "../index";
import { categories } from "../db/schema";
import authMiddleware, {
  AuthenticatedRequest,
} from "../middleware/authMiddleWare";
import { and, eq, isNull, or } from "drizzle-orm";

const categoriesRouter = Router();

// Postgres unique_violation (also wrapped by Drizzle as error.cause)
const isUniqueViolation = (error: unknown) => {
  const e = error as { code?: string; cause?: { code?: string } } | undefined;
  return e?.code === "23505" || e?.cause?.code === "23505";
};

//FETCH CATEGORIES
categoriesRouter.get(
  "/",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user?.userId;

      // 1. Double-check authentication payload
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized request" });
      }

      // 2. Query the database securely
      const fetchedCategories = await db
        .select()
        .from(categories)
        .where(
          or(
            isNull(categories.userId), // Fetches global app defaults
            eq(categories.userId, userId), // Fetches this specific user's custom categories
          ),
        );

      // 3. Return the combined array to the frontend
      return res.status(200).json(fetchedCategories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      return res.status(500).json({
        message: "Internal server error while fetching categories",
      });
    }
  },
);


//ADD CATEGORIES
categoriesRouter.post(
  "/",
  authMiddleware,
  async (req: AuthenticatedRequest, res) => {
    console.log("Add categories Route accessed");
    
    try {
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized request" });
      }

      const { name, icon, type } = req.body;

      // 1. Strict Input Validation
      if (
        typeof name !== "string" ||
        name.trim() === "" ||
        name.length > 50 ||
        typeof icon !== "string" ||
        icon.trim() === "" ||
        icon.length > 50 ||
        typeof type !== "string" ||
        !["Expense", "Income"].includes(type)
      ) {
        return res.status(400).json({
          message:
            "Invalid input. Name and icon are required (max 50 chars), and type must be 'Expense' or 'Income'.",
        });
      }

      const formattedName = name.trim();

      // 2. Prevent duplicate categories of the same type (both global defaults and user-specific)
      const existingCategory = await db
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.name, formattedName),
            eq(categories.type, type),
            or(
              isNull(categories.userId), // Checks if it's a global default
              eq(categories.userId, userId), // Checks if the user already created it
            ),
          ),
        )
        .limit(1);

      if (existingCategory.length > 0) {
        return res.status(409).json({
          message: `The ${type.toLowerCase()} category "${formattedName}" already exists.`,
        });
      }

      // 3. Insert the custom category
      const [newCategory] = await db
        .insert(categories)
        .values({
          userId,
          name: formattedName,
          icon: icon.trim(),
          type,
        })
        .returning();

      return res.status(201).json(newCategory);
    } catch (error) {
      // Two identical requests at the same time: the DB constraint catches the second one
      if (isUniqueViolation(error)) {
        return res
          .status(409)
          .json({ message: "This category already exists." });
      }
      console.error("Error creating category:", error);
      return res.status(500).json({
        message: "Internal server error while creating category",
      });
    }
  },
);

export default categoriesRouter;
