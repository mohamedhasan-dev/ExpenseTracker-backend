import { Router, type Response } from "express";
import { db } from "../index";
import authMiddleware, { AuthenticatedRequest } from "../middleware/authMiddleWare";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

const usersRouter = Router();

usersRouter.get("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  console.log("GET /users route accessed");
  if (!req.user?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const [user] = await db
      .select({ id: users.id, user_name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, req.user.userId));
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    return res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
});

export default usersRouter;
