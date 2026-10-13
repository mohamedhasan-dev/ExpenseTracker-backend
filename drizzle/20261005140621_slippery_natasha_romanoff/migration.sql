ALTER TABLE "transactions" ADD COLUMN "paymentMethod" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "description" DROP NOT NULL;