import { json, Router } from "express";
import bcrypt from "bcrypt";
import { db } from "../index";
import { users } from "../db/schema";
import { eq, or } from "drizzle-orm";
import jwt from "jsonwebtoken";
import "dotenv/config";

const router = Router();

//signup route
router.post("/", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required" });
    }
    const existingUser = await db
      .select()
      .from(users)
      .where(or(eq(users.email, email), eq(users.name, name)))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const HashedPassWord = await bcrypt.hash(password, 10);
    const result = await db
      .insert(users)
      .values({
        name: name,
        email: email,
        password: HashedPassWord,
      })
      .returning();
    res.json(result);
  } catch (error) {
    console.log("Something Went Wrong", error);
  }
});

//login route
router.post("/login", async (req, res) => {
  console.log("Login Route Accessed");
  try {
    const { nameoremail, password } = req.body;

    if (
      typeof nameoremail !== "string" ||
      typeof password !== "string" ||
      !nameoremail ||
      !password
    ) {
      return res.status(400).json({
        message: "Username/email and password are required",
      });
    }

    const [user] = await db
      .select({
        id: users.id,
        password: users.password,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(or(eq(users.email, nameoremail), eq(users.name, nameoremail)))
      .limit(1);

    if (!user) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const passwordValid = await bcrypt.compare(password, user.password);

    if (!passwordValid) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
      },
      process.env.JWT_SECRET as string,
      {
        expiresIn: "1h",
      },
    );

    return res.status(200).json({ token });
  } catch (error) {
    console.error("Error during login:", error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
});

export default router;
