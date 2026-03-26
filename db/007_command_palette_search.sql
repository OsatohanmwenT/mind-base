DROP FUNCTION IF EXISTS search_notes_palette(TEXT, INTEGER);
CREATE FUNCTION search_notes_palette(
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
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
  updated_at TIMESTAMPTZ,
  match_rank INTEGER
)
LANGUAGE sql
STABLE
AS $$
  WITH normalized_input AS (
    SELECT
      NULLIF(btrim(p_query), '') AS query,
      LEAST(GREATEST(COALESCE(p_limit, 10), 1), 20) AS result_limit
  ),
  notes_with_tags AS (
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
    GROUP BY n.id
  )
  SELECT
    nwt.id,
    nwt.user_id,
    nwt.title,
    nwt.content,
    nwt.summary,
    nwt.tags,
    nwt.status,
    nwt.created_at,
    nwt.updated_at,
    CASE
      WHEN lower(btrim(nwt.title)) LIKE lower(input.query) || '%' THEN 1
      WHEN lower(nwt.title) LIKE '%' || lower(input.query) || '%' THEN 2
      WHEN lower(nwt.summary) LIKE '%' || lower(input.query) || '%' THEN 3
      WHEN lower(nwt.content) LIKE '%' || lower(input.query) || '%' THEN 4
      WHEN EXISTS (
        SELECT 1
        FROM unnest(nwt.tags) AS tag_name
        WHERE lower(tag_name) LIKE '%' || lower(input.query) || '%'
      ) THEN 5
      ELSE 6
    END AS match_rank
  FROM notes_with_tags nwt
  CROSS JOIN normalized_input input
  WHERE input.query IS NOT NULL
    AND (
      nwt.title ILIKE '%' || input.query || '%'
      OR nwt.summary ILIKE '%' || input.query || '%'
      OR nwt.content ILIKE '%' || input.query || '%'
      OR EXISTS (
        SELECT 1
        FROM unnest(nwt.tags) AS tag_name
        WHERE tag_name ILIKE '%' || input.query || '%'
      )
    )
  ORDER BY match_rank ASC, nwt.updated_at DESC
  LIMIT (SELECT result_limit FROM normalized_input);
$$;
