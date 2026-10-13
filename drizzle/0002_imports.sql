CREATE TYPE "public"."import_kind" AS ENUM('spreadsheet', 'email');--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "import_kind" NOT NULL,
	"file_name" text,
	"file_sha256" text,
	"imported_by_id" text NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submission_count" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "import_id" uuid;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "source_label" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "source_fingerprint" text;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_imported_by_id_users_id_fk" FOREIGN KEY ("imported_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "imports_imported_at_index" ON "imports" USING btree ("imported_at");--> statement-breakpoint
CREATE INDEX "imports_file_sha256_index" ON "imports" USING btree ("file_sha256");--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submissions_import_id_index" ON "submissions" USING btree ("import_id");--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_sourceFingerprint_unique" UNIQUE("source_fingerprint");