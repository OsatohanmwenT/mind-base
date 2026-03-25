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
    AND nt.user_id = current_user_id;

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
  INSERT INTO note_tags (note_id, tag_id, user_id)
  SELECT p_note_id, t.id, current_user_id
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
