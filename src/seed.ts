import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { categories } from "./db/schema";

// Initialize database connection
const sql = neon(process.env.DATABASE_URL as string);
const db = drizzle({ client: sql });

const DEFAULT_CATEGORIES = [
  // Expenses
  { name: "Food", icon: "silverware-fork-knife", type: "Expense" },
  { name: "Transport", icon: "bus", type: "Expense" },
  { name: "Shopping", icon: "shopping-outline", type: "Expense" },
  { name: "Bills", icon: "receipt-text-outline", type: "Expense" },
  { name: "Entertainment", icon: "television-classic", type: "Expense" },
  { name: "Health", icon: "hospital-box-outline", type: "Expense" },
  { name: "Groceries", icon: "cart-outline", type: "Expense" },
  { name: "Education", icon: "school-outline", type: "Expense" },
  { name: "Tech", icon: "cpu-64-bit", type: "Expense" },
  { name: "Hobbies", icon: "fishbowl-outline", type: "Expense" },
  { name: "Other", icon: "dots-horizontal-circle-outline", type: "Expense" },

  // Incomes
  { name: "Allowance", icon: "wallet-outline", type: "Income" },
  { name: "Salary", icon: "bank-outline", type: "Income" },
  { name: "Freelance", icon: "code-tags", type: "Income" },
  { name: "Gifts", icon: "gift-outline", type: "Income" },
  { name: "Refunds", icon: "cash-refund", type: "Income" },
  { name: "Other", icon: "dots-horizontal-circle-outline", type: "Income" },
];

async function runSeed() {
  console.log("🌱 Seeding default categories...");

  try {
    await db.insert(categories).values(DEFAULT_CATEGORIES);
    console.log("✅ Defaults seeded successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
  }
}

runSeed();
