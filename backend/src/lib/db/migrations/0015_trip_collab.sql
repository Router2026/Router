-- 0015: plan a trip together — invite link, members, suggested stops and votes.
--
-- route_invites:       one active invite link per route. Only a SHA-256 of the token is stored,
--                      so a database leak doesn't hand out working links. A new link replaces
--                      the old one (the old token stops working).
-- route_collaborators: who joined through the link. They can suggest stops and vote; only the
--                      owner (routes.user_id) adds a suggestion to the route, edits or deletes.
-- route_suggestions:   a stop someone proposed; 'open' until the owner accepts or dismisses it.
-- route_suggestion_votes: one vote per member per suggestion (toggle).
--
-- Everything cascades from routes, so deleting a route cleans these up.
-- users lives in public (router.routes.user_id references public.users too).
-- Apply manually (same as 0001–0014). Idempotent; safe to re-run.
-- Rollback:
--   DROP TABLE IF EXISTS router.route_suggestion_votes, router.route_suggestions,
--                        router.route_collaborators, router.route_invites;

CREATE TABLE IF NOT EXISTS router.route_invites (
  route_id    INTEGER PRIMARY KEY REFERENCES router.routes(id) ON DELETE CASCADE,
  token_hash  CHAR(64) NOT NULL UNIQUE,
  created_by  INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS router.route_collaborators (
  route_id   INTEGER NOT NULL REFERENCES router.routes(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (route_id, user_id)
);
-- "Trips shared with me" looks up by user.
CREATE INDEX IF NOT EXISTS route_collaborators_user_idx ON router.route_collaborators (user_id);

CREATE TABLE IF NOT EXISTS router.route_suggestions (
  id            SERIAL PRIMARY KEY,
  route_id      INTEGER NOT NULL REFERENCES router.routes(id) ON DELETE CASCADE,
  location_id   INTEGER NOT NULL REFERENCES router.locations(id) ON DELETE CASCADE,
  suggested_by  INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  note          VARCHAR(200),
  status        VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'dismissed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- The same place can't be open twice on one route.
CREATE UNIQUE INDEX IF NOT EXISTS route_suggestions_open_uniq
  ON router.route_suggestions (route_id, location_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS route_suggestions_route_idx ON router.route_suggestions (route_id);

CREATE TABLE IF NOT EXISTS router.route_suggestion_votes (
  suggestion_id INTEGER NOT NULL REFERENCES router.route_suggestions(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (suggestion_id, user_id)
);

-- Backend connects as the table owner; RLS with no policies blocks the anon REST API (as in 0014).
ALTER TABLE router.route_invites          ENABLE ROW LEVEL SECURITY;
ALTER TABLE router.route_collaborators    ENABLE ROW LEVEL SECURITY;
ALTER TABLE router.route_suggestions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE router.route_suggestion_votes ENABLE ROW LEVEL SECURITY;
