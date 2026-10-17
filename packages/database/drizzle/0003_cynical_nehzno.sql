CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" varchar(32) NOT NULL,
	"storage_key" text NOT NULL,
	"original_file_name" varchar(255),
	"mime_type" varchar(128) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"etag" varchar(128),
	"duration_ms" integer,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"media_asset_id" uuid,
	"type" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_intents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"size_bytes" bigint NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"asset_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_intents" ADD CONSTRAINT "upload_intents_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_storage_key_unique" ON "media_assets" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "media_assets_project_id_idx" ON "media_assets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "media_assets_project_kind_idx" ON "media_assets" USING btree ("project_id","kind");--> statement-breakpoint
CREATE INDEX "processing_jobs_project_id_idx" ON "processing_jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "processing_jobs_status_type_idx" ON "processing_jobs" USING btree ("status","type");--> statement-breakpoint
CREATE UNIQUE INDEX "processing_jobs_ingestion_asset_unique" ON "processing_jobs" USING btree ("type","media_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "upload_intents_storage_key_unique" ON "upload_intents" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "upload_intents_project_id_idx" ON "upload_intents" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "upload_intents_expires_at_idx" ON "upload_intents" USING btree ("expires_at");