declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    TURSO_DATABASE_URL?: string;
    TURSO_AUTH_TOKEN?: string;
  }
}
