import { json, Router } from "express";
import bcrypt from "bcrypt";
import { db } from "../index";
import { users } from "../db/schema";
import { eq, or } from "drizzle-orm";
const router = Router();

router.post("/", async (req, res) => {
  try {
    const { name, email, password } = req.body;
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
    console.error("Something Went Wrong", error);
  }
});
router.post("/login", async (req, res) => {
  console.log("Login Route Accessed");
  
  const { nameoremail, password } = req.body;

  const HashedPword = await db
    .select({ password: users.password })
    .from(users)
    .where(or(eq(users.email, nameoremail), eq(users.name, nameoremail)));

  

  if (HashedPword.length != 0) {
    const pwordcheck = await bcrypt.compare(password, HashedPword[0].password);
    if (pwordcheck) {
      res.json("Success");
    } else res.json("Pword Failed");
  }else res.json("Failed")
});

export default router;
