DROP FUNCTION IF EXISTS list_notes_with_tags();
CREATE FUNCTION list_notes_with_tags(
  p_query TEXT DEFAULT NULL,
  p_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_sort TEXT DEFAULT 'updated'
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
  WITH normalized_input AS (
    SELECT
      NULLIF(btrim(p_query), '') AS query,
      COALESCE(
        ARRAY(
          SELECT DISTINCT normalized_tag
          FROM (
            SELECT NULLIF(
              lower(regexp_replace(btrim(raw_tag), '\s+', ' ', 'g')),
              ''
            ) AS normalized_tag
            FROM unnest(COALESCE(p_tags, ARRAY[]::TEXT[])) AS raw_tag
          ) normalized_tags
          WHERE normalized_tag IS NOT NULL
          ORDER BY normalized_tag
        ),
        ARRAY[]::TEXT[]
      ) AS active_tags,
      CASE p_sort
        WHEN 'updated' THEN 'updated'
        WHEN 'created' THEN 'created'
        WHEN 'alpha' THEN 'alpha'
        ELSE 'updated'
      END AS sort_mode
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
    nwt.updated_at
  FROM notes_with_tags nwt
  CROSS JOIN normalized_input input
  WHERE (
    input.query IS NULL
    OR nwt.title ILIKE '%' || input.query || '%'
    OR nwt.summary ILIKE '%' || input.query || '%'
    OR nwt.content ILIKE '%' || input.query || '%'
    OR EXISTS (
      SELECT 1
      FROM unnest(nwt.tags) AS tag_name
      WHERE tag_name ILIKE '%' || input.query || '%'
    )
  )
    AND (
      cardinality(input.active_tags) = 0
      OR input.active_tags <@ nwt.tags
    )
  ORDER BY
    CASE
      WHEN input.sort_mode = 'alpha' THEN
        CASE
          WHEN btrim(nwt.title) = '' THEN 'Untitled note'
          ELSE btrim(nwt.title)
        END
    END ASC,
    CASE
      WHEN input.sort_mode = 'updated' THEN nwt.updated_at
    END DESC,
    CASE
      WHEN input.sort_mode = 'updated' THEN nwt.created_at
    END DESC,
    CASE
      WHEN input.sort_mode = 'created' THEN nwt.created_at
    END DESC,
    CASE
      WHEN input.sort_mode = 'created' THEN nwt.updated_at
    END DESC,
    CASE
      WHEN input.sort_mode = 'alpha' THEN nwt.updated_at
    END DESC,
    nwt.id DESC;
$$;

DROP FUNCTION IF EXISTS count_notes();
CREATE FUNCTION count_notes()
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::BIGINT
  FROM notes
  WHERE user_id = (SELECT auth.uid());
$$;
