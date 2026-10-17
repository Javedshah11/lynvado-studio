CREATE TABLE "caption_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "caption_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"transcript_id" uuid NOT NULL,
	"language" varchar(16),
	"style" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clip_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"transcript_id" uuid NOT NULL,
	"start_ms" integer NOT NULL,
	"end_ms" integer NOT NULL,
	"title" varchar(160) NOT NULL,
	"score" double precision NOT NULL,
	"reason" text NOT NULL,
	"signals" jsonb NOT NULL,
	"status" varchar(32) DEFAULT 'suggested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "caption_segments" ADD CONSTRAINT "caption_segments_track_id_caption_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."caption_tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caption_tracks" ADD CONSTRAINT "caption_tracks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caption_tracks" ADD CONSTRAINT "caption_tracks_transcript_id_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clip_suggestions" ADD CONSTRAINT "clip_suggestions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clip_suggestions" ADD CONSTRAINT "clip_suggestions_transcript_id_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "caption_segments_position_unique" ON "caption_segments" USING btree ("track_id","position");--> statement-breakpoint
CREATE INDEX "caption_segments_time_idx" ON "caption_segments" USING btree ("track_id","start_ms");--> statement-breakpoint
CREATE UNIQUE INDEX "caption_tracks_transcript_id_unique" ON "caption_tracks" USING btree ("transcript_id");--> statement-breakpoint
CREATE INDEX "caption_tracks_project_id_idx" ON "caption_tracks" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clip_suggestions_window_unique" ON "clip_suggestions" USING btree ("transcript_id","start_ms","end_ms");--> statement-breakpoint
CREATE INDEX "clip_suggestions_project_score_idx" ON "clip_suggestions" USING btree ("project_id","score");