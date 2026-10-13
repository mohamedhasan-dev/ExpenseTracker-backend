CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid,
	"name" varchar(50) NOT NULL,
	"icon" varchar(50) NOT NULL,
	"type" varchar(50) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "category_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id");