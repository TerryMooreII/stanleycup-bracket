
CREATE OR REPLACE FUNCTION get_career_stats()
RETURNS TABLE (
  user_id uuid,
  display_name text,
  total_points bigint,
  total_correct bigint,
  total_picks bigint,
  seasons_played bigint,
  r1_correct bigint, r1_decided bigint,
  r2_correct bigint, r2_decided bigint,
  r3_correct bigint, r3_decided bigint,
  r4_correct bigint, r4_decided bigint,
  season_details jsonb
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH pick_details AS (
    SELECT
      p.user_id,
      pr.display_name,
      s.year,
      s.is_active,
      r.round_number,
      r.points_per_correct,
      CASE WHEN m.winner_id IS NOT NULL AND p.team_id = m.winner_id THEN 1 ELSE 0 END AS is_correct,
      CASE WHEN m.winner_id IS NOT NULL THEN 1 ELSE 0 END AS is_decided
    FROM picks p
    JOIN matchups m ON p.matchup_id = m.id
    JOIN rounds r ON m.round_id = r.id
    JOIN seasons s ON r.season_id = s.id
    JOIN profiles pr ON p.user_id = pr.id
  ),
  per_season AS (
    SELECT
      pd.user_id, pd.display_name, pd.year, pd.is_active,
      SUM(pd.is_correct * pd.points_per_correct) AS points,
      SUM(pd.is_correct) AS correct,
      COUNT(*) AS picks,
      SUM(pd.is_decided) AS decided
    FROM pick_details pd
    GROUP BY pd.user_id, pd.display_name, pd.year, pd.is_active
  ),
  season_json AS (
    SELECT
      ps2.user_id,
      jsonb_agg(
        jsonb_build_object(
          'year', ps2.year,
          'points', ps2.points,
          'correct', ps2.correct,
          'total', ps2.picks,
          'accuracy', CASE WHEN ps2.decided > 0 THEN ROUND((ps2.correct::numeric / ps2.decided) * 100) ELSE NULL END
        ) ORDER BY ps2.year DESC
      ) AS season_details
    FROM per_season ps2
    GROUP BY ps2.user_id
  ),
  round_stats AS (
    SELECT
      pd2.user_id,
      SUM(CASE WHEN pd2.round_number = 1 THEN pd2.is_correct ELSE 0 END) AS r1_correct,
      SUM(CASE WHEN pd2.round_number = 1 THEN pd2.is_decided ELSE 0 END) AS r1_decided,
      SUM(CASE WHEN pd2.round_number = 2 THEN pd2.is_correct ELSE 0 END) AS r2_correct,
      SUM(CASE WHEN pd2.round_number = 2 THEN pd2.is_decided ELSE 0 END) AS r2_decided,
      SUM(CASE WHEN pd2.round_number = 3 THEN pd2.is_correct ELSE 0 END) AS r3_correct,
      SUM(CASE WHEN pd2.round_number = 3 THEN pd2.is_decided ELSE 0 END) AS r3_decided,
      SUM(CASE WHEN pd2.round_number = 4 THEN pd2.is_correct ELSE 0 END) AS r4_correct,
      SUM(CASE WHEN pd2.round_number = 4 THEN pd2.is_decided ELSE 0 END) AS r4_decided
    FROM pick_details pd2
    GROUP BY pd2.user_id
  )
  SELECT
    ps.user_id,
    ps.display_name,
    SUM(ps.points)::bigint AS total_points,
    SUM(ps.correct)::bigint AS total_correct,
    SUM(ps.picks)::bigint AS total_picks,
    COUNT(DISTINCT ps.year)::bigint AS seasons_played,
    COALESCE(rs.r1_correct, 0)::bigint, COALESCE(rs.r1_decided, 0)::bigint,
    COALESCE(rs.r2_correct, 0)::bigint, COALESCE(rs.r2_decided, 0)::bigint,
    COALESCE(rs.r3_correct, 0)::bigint, COALESCE(rs.r3_decided, 0)::bigint,
    COALESCE(rs.r4_correct, 0)::bigint, COALESCE(rs.r4_decided, 0)::bigint,
    sj.season_details
  FROM per_season ps
  JOIN round_stats rs ON ps.user_id = rs.user_id
  JOIN season_json sj ON ps.user_id = sj.user_id
  GROUP BY ps.user_id, ps.display_name, rs.r1_correct, rs.r1_decided, rs.r2_correct, rs.r2_decided, rs.r3_correct, rs.r3_decided, rs.r4_correct, rs.r4_decided, sj.season_details
  ORDER BY total_points DESC, total_correct DESC, ps.display_name;
END;
$$;
