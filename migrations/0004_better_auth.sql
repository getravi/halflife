-- Generated from Better Auth 1.6.25. Do not hand-edit.
--
-- Captured by running getMigrations() inside the Workers test pool and reading
-- back sqlite_master. Regenerate the same way when better-auth changes: the
-- point is that this is Better Auth's own DDL rather than a hand-written
-- approximation that drifts from what the library expects.
--
-- Committed as a migration rather than created at runtime because migrations
-- here are files wrangler applies, and a library reaching into the database on
-- boot would put the schema outside the one place anyone reads to learn it.

CREATE TABLE "user" (
  "id"            text not null primary key,
  "name"          text not null,
  "email"         text not null unique,
  "emailVerified" integer not null,
  "image"         text,
  "createdAt"     date not null,
  "updatedAt"     date not null
);

CREATE TABLE "session" (
  "id"        text not null primary key,
  "expiresAt" date not null,
  "token"     text not null unique,
  "createdAt" date not null,
  "updatedAt" date not null,
  "ipAddress" text,
  "userAgent" text,
  "userId"    text not null references "user" ("id") on delete cascade
);

CREATE TABLE "account" (
  "id"                     text not null primary key,
  "accountId"              text not null,
  "providerId"             text not null,
  "userId"                 text not null references "user" ("id") on delete cascade,
  "accessToken"            text,
  "refreshToken"           text,
  "idToken"                text,
  "accessTokenExpiresAt"   date,
  "refreshTokenExpiresAt"  date,
  "scope"                  text,
  "password"               text,
  "createdAt"              date not null,
  "updatedAt"              date not null
);

CREATE TABLE "verification" (
  "id"         text not null primary key,
  "identifier" text not null,
  "value"      text not null,
  "expiresAt"  date not null,
  "createdAt"  date not null,
  "updatedAt"  date not null
);
