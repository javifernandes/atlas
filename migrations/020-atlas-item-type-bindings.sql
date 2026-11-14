CREATE TABLE atlas_type_bindings (
  id text PRIMARY KEY,
  source_item_id text NOT NULL REFERENCES atlas_items(id) ON DELETE CASCADE,
  target_item_id text NOT NULL REFERENCES atlas_items(id) ON DELETE CASCADE,
  source_id text NOT NULL,
  source_revision_id text NOT NULL REFERENCES atlas_source_revisions(id),
  source_record_id text NOT NULL REFERENCES atlas_source_records(id) ON DELETE CASCADE
);

CREATE INDEX atlas_type_bindings_source_idx ON atlas_type_bindings (source_id);
CREATE INDEX atlas_type_bindings_source_item_idx ON atlas_type_bindings (source_item_id);
CREATE INDEX atlas_type_bindings_target_item_idx ON atlas_type_bindings (target_item_id);
