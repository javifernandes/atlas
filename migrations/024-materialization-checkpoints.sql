CREATE TABLE atlas_materialization_checkpoints (
  scope_id text NOT NULL,
  derivation_id text NOT NULL,
  materializer_version text NOT NULL,
  source_frontier text NOT NULL,
  accepted_frontier text NOT NULL,
  state_json text NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (scope_id, derivation_id)
);

CREATE TABLE atlas_materialization_artifacts (
  scope_id text NOT NULL,
  derivation_id text NOT NULL,
  artifact_id text NOT NULL,
  source_record_identity text NOT NULL,
  source_path text NOT NULL,
  content_hash text NOT NULL,
  materializer_version text NOT NULL,
  payload_json text NOT NULL,
  PRIMARY KEY (scope_id, derivation_id, source_record_identity),
  UNIQUE (scope_id, derivation_id, artifact_id),
  FOREIGN KEY (scope_id, derivation_id)
    REFERENCES atlas_materialization_checkpoints(scope_id, derivation_id)
    ON DELETE CASCADE
);

CREATE TABLE atlas_materialization_dependencies (
  scope_id text NOT NULL,
  derivation_id text NOT NULL,
  input_identity text NOT NULL,
  outputs_json text NOT NULL,
  PRIMARY KEY (scope_id, derivation_id, input_identity),
  FOREIGN KEY (scope_id, derivation_id)
    REFERENCES atlas_materialization_checkpoints(scope_id, derivation_id)
    ON DELETE CASCADE
);
