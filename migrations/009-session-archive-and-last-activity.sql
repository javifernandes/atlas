ALTER TABLE atlas_execution_streams
  ADD COLUMN archived_at timestamptz,
  ADD COLUMN last_activity_at timestamptz;

UPDATE atlas_execution_streams AS stream
SET last_activity_at = activity.last_activity_at
FROM (
  SELECT stream_id, max(occurred_at) AS last_activity_at
  FROM atlas_execution_stream_activities
  GROUP BY stream_id
) AS activity
WHERE activity.stream_id = stream.id;

CREATE INDEX atlas_execution_streams_user_unarchived_idx
  ON atlas_execution_streams (user_id, opened_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX atlas_execution_streams_user_archived_idx
  ON atlas_execution_streams (user_id, archived_at DESC)
  WHERE archived_at IS NOT NULL;
