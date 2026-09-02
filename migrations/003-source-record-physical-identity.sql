ALTER TABLE atlas_source_records
  DROP CONSTRAINT atlas_source_records_canonical_path_key;

CREATE INDEX atlas_source_records_canonical_path_idx
  ON atlas_source_records (canonical_path);
