import {Router} from "express";
import { db } from "../index"
import { type Response } from "express";
import authMiddleware,{AuthenticatedRequest} from "../middleware/authMiddleWare";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";


const usersRouter = Router();

usersRouter.get('/',authMiddleware,async (req:AuthenticatedRequest,res:Response)=>{
    console.log("GET /users route accessed")
    if(!req.user?.userId){
        return res.status(500).json({"message":"Internal Server Error"})
    }
    const [user] = await db.select({id:users.id,user_name:users.name,email:users.email}).from(users).where(eq(users.id,req.user?.userId))
    console.log("User fetched:", user);
    return res.json(user)
})


export default usersRouter


