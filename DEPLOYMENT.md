# Lynvado Studio deployment

The production compose stack runs PostgreSQL, Redis, MinIO, the API, web app,
intelligence service, Ollama, both workers, and one-shot database migration and
Ollama model-pull services.

1. Copy `.env.example` to a deployment-only environment file.
2. Set strong `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD`, and
   `JWT_ACCESS_SECRET` values. Set `WEB_ORIGIN` and `PUBLIC_API_URL` to the
   externally reachable HTTPS origins.
3. Build and start the stack:

   ```sh
   docker compose --env-file .env.production -f docker/compose.deploy.yml up -d --build
   ```

4. Verify `api`, `web`, `postgres`, `redis`, `minio`, and `intelligence` are
   healthy, and confirm that the `migrate` service exited successfully.

Keep the API, MinIO, and databases behind a TLS-terminating reverse proxy in
production. Only expose the web app and API publicly; MinIO's signed object
URLs should be routed through a protected storage hostname when remote clients
need direct upload and download access.
