CREATE INDEX projection_revisions_started_idx
  ON projection_revisions (started_at DESC, id DESC);
