ALTER TABLE atlas_execution_streams
  ADD COLUMN forked_from_stream_id uuid
    REFERENCES atlas_execution_streams(id) ON DELETE SET NULL;

CREATE INDEX atlas_execution_streams_forked_from_idx
  ON atlas_execution_streams (forked_from_stream_id);

ALTER TABLE atlas_execution_stream_activities
  DROP CONSTRAINT atlas_execution_stream_activities_attribution_check;

ALTER TABLE atlas_execution_stream_activities
  ADD CONSTRAINT atlas_execution_stream_activities_attribution_check
  CHECK (attribution IN ('implicit-single-open', 'explicit-directive'));
