CREATE TYPE "public"."channel" AS ENUM('email', 'landing_page', 'social', 'direct_mail', 'display_ad');--> statement-breakpoint
CREATE TYPE "public"."comment_kind" AS ENUM('comment', 'decision', 'resubmission');--> statement-breakpoint
CREATE TYPE "public"."version_outcome" AS ENUM('approved', 'changes_requested', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."product_line" AS ENUM('personal_loan', 'credit_card', 'mortgage_prequal');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('submitter', 'reviewer', 'compliance_lead');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('submitted', 'in_review', 'changes_requested', 'approved', 'rejected');--> statement-breakpoint
CREATE SEQUENCE "public"."submission_reference_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1001 CACHE 1;--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" text,
	"actor_role" "role",
	"action" text NOT NULL,
	"submission_id" uuid,
	"reference" text,
	"summary" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"session_id" text
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"author_id" text NOT NULL,
	"kind" "comment_kind" DEFAULT 'comment' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"body" text NOT NULL,
	"findings" jsonb NOT NULL,
	"risk_score" integer NOT NULL,
	"risk_level" "risk_level" NOT NULL,
	"engine_version" text NOT NULL,
	"note" text,
	"submitted_by_id" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sla_due_at" timestamp with time zone NOT NULL,
	"review_started_at" timestamp with time zone,
	"reviewer_id" text,
	"decided_at" timestamp with time zone,
	"decided_by_id" text,
	"outcome" "version_outcome",
	CONSTRAINT "submission_versions_decision_complete" CHECK (("submission_versions"."outcome" IS NULL) = ("submission_versions"."decided_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text DEFAULT 'MKT-' || nextval('submission_reference_seq') NOT NULL,
	"title" text NOT NULL,
	"product_line" "product_line" NOT NULL,
	"channel" "channel" NOT NULL,
	"target_launch_date" date NOT NULL,
	"status" "submission_status" DEFAULT 'submitted' NOT NULL,
	"submitter_id" text NOT NULL,
	"assignee_id" text,
	"current_version" integer DEFAULT 1 NOT NULL,
	"risk_score" integer NOT NULL,
	"risk_level" "risk_level" NOT NULL,
	"sla_due_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "submissions_reference_unique" UNIQUE("reference"),
	CONSTRAINT "submissions_risk_score_range" CHECK ("submissions"."risk_score" BETWEEN 0 AND 100),
	CONSTRAINT "submissions_current_version_positive" CHECK ("submissions"."current_version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "role" NOT NULL,
	"title" text NOT NULL,
	"team" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_versions" ADD CONSTRAINT "submission_versions_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_versions" ADD CONSTRAINT "submission_versions_submitted_by_id_users_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_versions" ADD CONSTRAINT "submission_versions_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_versions" ADD CONSTRAINT "submission_versions_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submitter_id_users_id_fk" FOREIGN KEY ("submitter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_occurred_at_index" ON "audit_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_submission_id_index" ON "audit_events" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "audit_events_action_index" ON "audit_events" USING btree ("action");--> statement-breakpoint
CREATE INDEX "comments_submission_id_created_at_index" ON "comments" USING btree ("submission_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_versions_submission_id_version_index" ON "submission_versions" USING btree ("submission_id","version");--> statement-breakpoint
CREATE INDEX "submissions_status_index" ON "submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "submissions_assignee_id_index" ON "submissions" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "submissions_submitter_id_index" ON "submissions" USING btree ("submitter_id");