ALTER TABLE note_tags
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'user';

ALTER TABLE note_tags
  DROP CONSTRAINT IF EXISTS note_tags_source_check;

ALTER TABLE note_tags
  ADD CONSTRAINT note_tags_source_check
  CHECK (source IN ('user', 'ai'));

CREATE INDEX IF NOT EXISTS note_tags_user_id_note_id_source_idx
  ON note_tags(user_id, note_id, source);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_auto_organize_model_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_preferences_select_own" ON user_preferences;
CREATE POLICY "user_preferences_select_own" ON user_preferences
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_preferences_insert_own" ON user_preferences;
CREATE POLICY "user_preferences_insert_own" ON user_preferences
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_preferences_update_own" ON user_preferences;
CREATE POLICY "user_preferences_update_own" ON user_preferences
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_preferences_delete_own" ON user_preferences;
CREATE POLICY "user_preferences_delete_own" ON user_preferences
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));

DROP TRIGGER IF EXISTS user_preferences_updated_at ON user_preferences;
CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();

CREATE TABLE IF NOT EXISTS note_auto_organize_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_model_id TEXT NOT NULL,
  resolved_model_id TEXT,
  source_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started',
  latency_ms INTEGER,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  CONSTRAINT note_auto_organize_runs_status_check
    CHECK (status IN ('started', 'succeeded', 'failed', 'rate_limited'))
);

CREATE INDEX IF NOT EXISTS note_auto_organize_runs_user_id_created_at_idx
  ON note_auto_organize_runs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS note_auto_organize_runs_note_id_created_at_idx
  ON note_auto_organize_runs(note_id, created_at DESC);

ALTER TABLE note_auto_organize_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "note_auto_organize_runs_select_own" ON note_auto_organize_runs;
CREATE POLICY "note_auto_organize_runs_select_own" ON note_auto_organize_runs
  FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM notes
      WHERE notes.id = note_auto_organize_runs.note_id
        AND notes.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "note_auto_organize_runs_insert_own" ON note_auto_organize_runs;
CREATE POLICY "note_auto_organize_runs_insert_own" ON note_auto_organize_runs
  FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM notes
      WHERE notes.id = note_auto_organize_runs.note_id
        AND notes.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "note_auto_organize_runs_update_own" ON note_auto_organize_runs;
CREATE POLICY "note_auto_organize_runs_update_own" ON note_auto_organize_runs
  FOR UPDATE
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM notes
      WHERE notes.id = note_auto_organize_runs.note_id
        AND notes.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM notes
      WHERE notes.id = note_auto_organize_runs.note_id
        AND notes.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "note_auto_organize_runs_delete_own" ON note_auto_organize_runs;
CREATE POLICY "note_auto_organize_runs_delete_own" ON note_auto_organize_runs
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));

DROP TRIGGER IF EXISTS note_auto_organize_runs_updated_at ON note_auto_organize_runs;
CREATE TRIGGER note_auto_organize_runs_updated_at
  BEFORE UPDATE ON note_auto_organize_runs
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();

DROP FUNCTION IF EXISTS create_note_with_tags(TEXT, TEXT, TEXT[]);
CREATE FUNCTION create_note_with_tags(
  p_title TEXT,
  p_content TEXT,
  p_tags TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  new_note_id UUID;
  normalized_tag TEXT;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO notes (user_id, title, content, summary, status)
  VALUES (current_user_id, COALESCE(p_title, ''), p_content, '', 'draft')
  RETURNING id INTO new_note_id;

  FOR normalized_tag IN
    SELECT DISTINCT NULLIF(
      lower(regexp_replace(btrim(raw_tag), '\s+', ' ', 'g')),
      ''
    )
    FROM unnest(COALESCE(p_tags, ARRAY[]::TEXT[])) AS raw_tag
    WHERE NULLIF(lower(regexp_replace(btrim(raw_tag), '\s+', ' ', 'g')), '') IS NOT NULL
  LOOP
    INSERT INTO tags (user_id, name)
    VALUES (current_user_id, normalized_tag)
    ON CONFLICT (user_id, name) DO NOTHING;

    INSERT INTO note_tags (note_id, tag_id, user_id, source)
    SELECT new_note_id, t.id, current_user_id, 'user'
    FROM tags t
    WHERE t.user_id = current_user_id
      AND t.name = normalized_tag
    ON CONFLICT (note_id, tag_id) DO UPDATE
    SET source = 'user', user_id = EXCLUDED.user_id;
  END LOOP;

  RETURN new_note_id;
END;
$$;

DROP FUNCTION IF EXISTS get_note_with_tags(UUID);
CREATE FUNCTION get_note_with_tags(
  p_note_id UUID
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  content TEXT,
  summary TEXT,
  tags TEXT[],
  user_tags TEXT[],
  ai_tags TEXT[],
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    n.id,
    n.user_id,
    n.title,
    n.content,
    n.summary,
    COALESCE(
      ARRAY_AGG(t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL),
      ARRAY[]::TEXT[]
    ) AS tags,
    COALESCE(
      ARRAY_AGG(t.name ORDER BY t.name)
        FILTER (WHERE t.name IS NOT NULL AND nt.source = 'user'),
      ARRAY[]::TEXT[]
    ) AS user_tags,
    COALESCE(
      ARRAY_AGG(t.name ORDER BY t.name)
        FILTER (WHERE t.name IS NOT NULL AND nt.source = 'ai'),
      ARRAY[]::TEXT[]
    ) AS ai_tags,
    n.status,
    n.created_at,
    n.updated_at
  FROM notes n
  LEFT JOIN note_tags nt
    ON nt.note_id = n.id
   AND nt.user_id = n.user_id
  LEFT JOIN tags t
    ON t.id = nt.tag_id
   AND t.user_id = n.user_id
  WHERE n.user_id = (SELECT auth.uid())
    AND n.id = p_note_id
  GROUP BY n.id;
$$;

DROP FUNCTION IF EXISTS update_note_with_tags(UUID, TEXT, TEXT, TEXT[]);
CREATE FUNCTION update_note_with_tags(
  p_note_id UUID,
  p_title TEXT,
  p_content TEXT,
  p_tags TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  content TEXT,
  summary TEXT,
  tags TEXT[],
  user_tags TEXT[],
  ai_tags TEXT[],
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM notes n
    WHERE n.id = p_note_id
      AND n.user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'Note not found';
  END IF;

  UPDATE notes AS n
  SET
    title = COALESCE(p_title, ''),
    content = p_content
  WHERE n.id = p_note_id
    AND n.user_id = current_user_id;

  WITH normalized_tags AS (
    SELECT DISTINCT normalized_tag
    FROM (
      SELECT NULLIF(
        lower(regexp_replace(btrim(raw_tag), '\s+', ' ', 'g')),
        ''
      ) AS normalized_tag
      FROM unnest(COALESCE(p_tags, ARRAY[]::TEXT[])) AS raw_tag
    ) cleaned_tags
    WHERE normalized_tag IS NOT NULL
      AND char_length(normalized_tag) <= 40
    ORDER BY normalized_tag
    LIMIT 10
  )
  INSERT INTO tags (user_id, name)
  SELECT current_user_id, normalized_tag
  FROM normalized_tags
  ON CONFLICT ON CONSTRAINT tags_user_id_name_key DO NOTHING;

  DELETE FROM note_tags nt
  WHERE nt.note_id = p_note_id
    AND nt.user_id = current_user_id
    AND nt.source = 'user';

  WITH normalized_tags AS (
    SELECT DISTINCT normalized_tag
    FROM (
      SELECT NULLIF(
        lower(regexp_replace(btrim(raw_tag), '\s+', ' ', 'g')),
        ''
      ) AS normalized_tag
      FROM unnest(COALESCE(p_tags, ARRAY[]::TEXT[])) AS raw_tag
    ) cleaned_tags
    WHERE normalized_tag IS NOT NULL
      AND char_length(normalized_tag) <= 40
    ORDER BY normalized_tag
    LIMIT 10
  )
  INSERT INTO note_tags (note_id, tag_id, user_id, source)
  SELECT p_note_id, t.id, current_user_id, 'user'
  FROM normalized_tags nt
  JOIN tags t
    ON t.user_id = current_user_id
   AND t.name = nt.normalized_tag
  ON CONFLICT ON CONSTRAINT note_tags_pkey DO UPDATE
  SET source = 'user', user_id = EXCLUDED.user_id;

  RETURN QUERY
  SELECT *
  FROM get_note_with_tags(p_note_id);
END;
$$;

DROP FUNCTION IF EXISTS apply_note_auto_organization(UUID, TEXT, TEXT, TEXT[]);
CREATE FUNCTION apply_note_auto_organization(
  p_note_id UUID,
  p_title TEXT,
  p_summary TEXT,
  p_ai_tags TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  title TEXT,
  content TEXT,
  summary TEXT,
  tags TEXT[],
  user_tags TEXT[],
  ai_tags TEXT[],
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
  current_user_id UUID := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM notes n
    WHERE n.id = p_note_id
      AND n.user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'Note not found';
  END IF;

  UPDATE notes AS n
  SET
    title = COALESCE(p_title, ''),
    summary = COALESCE(p_summary, ''),
    status = 'organized'
  WHERE n.id = p_note_id
    AND n.user_id = current_user_id;

  WITH normalized_tags AS (
    SELECT DISTINCT normalized_tag
    FROM (
      SELECT NULLIF(
        lower(regexp_replace(btrim(raw_tag), '\s+', ' ', 'g')),
        ''
      ) AS normalized_tag
      FROM unnest(COALESCE(p_ai_tags, ARRAY[]::TEXT[])) AS raw_tag
    ) cleaned_tags
    WHERE normalized_tag IS NOT NULL
      AND char_length(normalized_tag) <= 40
    ORDER BY normalized_tag
    LIMIT 3
  )
  INSERT INTO tags (user_id, name)
  SELECT current_user_id, normalized_tag
  FROM normalized_tags
  ON CONFLICT ON CONSTRAINT tags_user_id_name_key DO NOTHING;

  DELETE FROM note_tags nt
  WHERE nt.note_id = p_note_id
    AND nt.user_id = current_user_id
    AND nt.source = 'ai';

  WITH normalized_tags AS (
    SELECT DISTINCT normalized_tag
    FROM (
      SELECT NULLIF(
        lower(regexp_replace(btrim(raw_tag), '\s+', ' ', 'g')),
        ''
      ) AS normalized_tag
      FROM unnest(COALESCE(p_ai_tags, ARRAY[]::TEXT[])) AS raw_tag
    ) cleaned_tags
    WHERE normalized_tag IS NOT NULL
      AND char_length(normalized_tag) <= 40
    ORDER BY normalized_tag
    LIMIT 3
  )
  INSERT INTO note_tags (note_id, tag_id, user_id, source)
  SELECT p_note_id, t.id, current_user_id, 'ai'
  FROM normalized_tags nt
  JOIN tags t
    ON t.user_id = current_user_id
   AND t.name = nt.normalized_tag
  ON CONFLICT ON CONSTRAINT note_tags_pkey DO NOTHING;

  RETURN QUERY
  SELECT *
  FROM get_note_with_tags(p_note_id);
END;
$$;
