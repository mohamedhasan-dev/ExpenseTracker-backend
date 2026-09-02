CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"amount" varchar(255) NOT NULL,
	"description" varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL,
	"date" varchar(255) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");