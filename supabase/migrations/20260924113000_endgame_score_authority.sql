-- ============================================================================
-- ENDGAME: server-authoritative score submission
-- Date: 2026-09-24
-- Author: Wren (delegated by Bryan)
--
-- What this does:
--   1. Creates public.song_max_scores: per-song theoretical max scores,
--      computed by replaying the client's own perfect-play simulation
--      (GameplayCore.tsx calcScore, incl. power-up stage cycles) against every
--      static chart variant. Cap = ceil(max true_max across variants * 1.05).
--      Script: goals/pim-supabase-security-advisor-review/hidden_files/maxscore_sim.py
--   2. Creates public.submit_score RPC (SECURITY DEFINER): the single
--      server-authoritative write path for gameplay scores. Binds user_id to
--      auth.uid() (callers cannot spoof identity), enforces per-song caps
--      (10M global fallback for unknown/future songs), medal/accuracy
--      plausibility using the CLIENT's real thresholds
--      (PLATINUM>=93, GOLD>=80, SILVER>=60, BRONZE>=40 -- the edge function
--      used stricter mismatched thresholds that rejected legit scores),
--      combo bounds, and tier normalization.
--   3. Revokes direct authenticated INSERT/UPDATE on gameplay_records.
--      Remaining write paths: this RPC and the vault-engine edge function
--      (service_role, identity-bound). The validate_gameplay_score trigger
--      (10/min/user, positive scores, 72.3M absolute cap) remains as backstop.
--   4. Client (lewdview/PIM) calls supabase.rpc('submit_score', ...) via
--      submitGameplayRecord; the hs_* localStorage auto-submit migration is
--      removed (local scores are display-only).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.song_max_scores (
  song_id text PRIMARY KEY,
  max_score integer NOT NULL,
  computed_from text NOT NULL DEFAULT 'chart-sim-v1',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.song_max_scores (song_id, max_score) VALUES
  ('break-of-light', 2365860),
  ('day-001', 4619160),
  ('day-002', 1518195),
  ('day-003', 2231145),
  ('day-004', 1546650),
  ('day-005', 1360065),
  ('day-006', 3005310),
  ('day-007', 2116275),
  ('day-008', 2173605),
  ('day-009', 1390830),
  ('day-010', 2653455),
  ('day-011', 3160710),
  ('day-012', 2655030),
  ('day-013', 2141895),
  ('day-014', 2424030),
  ('day-015', 2018205),
  ('day-016', 3837540),
  ('day-017', 1576995),
  ('day-018', 2705640),
  ('day-019', 2505930),
  ('day-020', 5018790),
  ('day-021', 1948800),
  ('day-022', 2711100),
  ('day-023', 2353890),
  ('day-024', 2518320),
  ('day-025', 1686300),
  ('day-026', 3288915),
  ('day-027', 3069675),
  ('day-028', 3109575),
  ('day-029', 4922610),
  ('day-030', 799995),
  ('day-031', 1608705),
  ('day-032', 2054010),
  ('day-033', 1911420),
  ('day-034', 1998465),
  ('day-035', 2472960),
  ('day-036', 3659250),
  ('day-037', 3025470),
  ('day-038', 1595580),
  ('day-039', 1337070),
  ('day-040', 1709505),
  ('day-041', 2170245),
  ('day-042', 2023770),
  ('day-043', 2802870),
  ('day-044', 3570630),
  ('day-045', 1469475),
  ('day-046', 2669625),
  ('day-047', 1965810),
  ('day-048', 3335745),
  ('day-049', 1678110),
  ('day-050', 2631090),
  ('day-051', 1545075),
  ('day-052', 2587305),
  ('day-053', 1572480),
  ('day-054', 3368190),
  ('day-055', 2172030),
  ('day-056', 1427265),
  ('day-057', 2254140),
  ('day-058', 1584555),
  ('day-059', 4517520),
  ('day-060', 1537305),
  ('day-061', 924630),
  ('day-062', 3465105),
  ('day-063', 1436505),
  ('day-064', 1970220),
  ('day-065', 1025010),
  ('day-066', 1456560),
  ('day-067', 4871790),
  ('day-068', 1795395),
  ('day-069', 991410),
  ('day-070', 1719900),
  ('day-071', 1127595),
  ('day-072', 1176735),
  ('day-073', 1195215),
  ('day-074', 1684095),
  ('day-075', 6129270),
  ('day-076', 1981875),
  ('day-077', 4126815),
  ('day-078', 3789030),
  ('day-079', 3671010),
  ('day-080', 1111740),
  ('day-081', 3030300),
  ('day-082', 5634090),
  ('day-083', 6102600),
  ('day-084', 2297190),
  ('day-085', 1169175),
  ('day-086', 2720340),
  ('day-087', 2895900),
  ('day-088', 2215290),
  ('day-089', 5450550),
  ('day-090', 6573000),
  ('day-091', 2047185),
  ('day-092', 2736510),
  ('day-093', 1382115),
  ('day-094', 1913520),
  ('day-095', 1494675),
  ('day-096', 1666350),
  ('day-097', 2146200),
  ('day-098', 6393660),
  ('day-099', 1807365),
  ('day-100', 2215080),
  ('day-101', 2971080),
  ('day-102', 2069970),
  ('day-103', 1279530),
  ('day-104', 2302965),
  ('day-105', 2597595),
  ('day-106', 2449650),
  ('day-107', 1102815),
  ('day-108', 1875195),
  ('day-109', 5933970),
  ('day-110', 3951360),
  ('day-111', 2967300),
  ('day-112', 2642325),
  ('day-113', 2709315),
  ('day-114', 1547490),
  ('day-115', 2409855),
  ('day-116', 1213800),
  ('day-117', 2784390),
  ('day-118', 1693650),
  ('day-119', 2807490),
  ('day-120', 2143470),
  ('day-121', 6027000),
  ('day-122', 2532180),
  ('day-123', 2299395),
  ('day-124', 2822505),
  ('day-125', 3813600),
  ('day-126', 2297085),
  ('day-127', 1083285),
  ('day-128', 4926180),
  ('day-129', 4208190),
  ('day-130', 4329570),
  ('day-131', 2548770),
  ('day-132', 2003400),
  ('day-133', 5563740),
  ('day-134', 2425290),
  ('day-135', 2082780),
  ('day-136', 1291500),
  ('day-137', 1487325),
  ('day-138', 3908100),
  ('day-139', 4020870),
  ('day-140', 4635750),
  ('day-141', 2302020),
  ('day-142', 3214365),
  ('day-142_old', 3214365),
  ('day-143', 2528820),
  ('day-144', 2753835),
  ('day-145', 1504650),
  ('day-146', 2812425),
  ('day-147', 1372875),
  ('day-148', 3666390),
  ('day-149', 1632540),
  ('day-150', 5811960),
  ('day-151', 2337195),
  ('day-152', 1697430),
  ('day-153', 4604880),
  ('day-154', 1933050),
  ('day-155', 2428335),
  ('day-156', 1258425),
  ('day-157', 4939830),
  ('day-158', 3887730),
  ('day-159', 5362770),
  ('day-160', 2571975),
  ('day-161', 2105775),
  ('day-162', 3632790),
  ('day-163', 1879605),
  ('day-164', 4133220),
  ('day-165', 2105985),
  ('day-166', 2719920),
  ('day-167', 1743315),
  ('day-168', 1607130),
  ('day-169', 3145065),
  ('day-170', 4919250),
  ('day-171', 2636130),
  ('day-172', 1653435),
  ('day-173', 3400005),
  ('day-174', 962220),
  ('day-175', 1434510),
  ('day-176', 4595430),
  ('day-177', 2078475),
  ('day-178', 1973790),
  ('day-179', 2008965),
  ('day-180', 2302020),
  ('day-181', 2424030),
  ('day-182', 1377705),
  ('day-183', 1128960),
  ('day-184', 1429208),
  ('day-185', 1937565),
  ('day-186', 4486650),
  ('day-187', 6105120),
  ('day-188', 3542490),
  ('day-189', 3114930),
  ('day-190', 1106385),
  ('day-191', 3001950),
  ('day-192', 1525335),
  ('day-193', 1800330),
  ('day-194', 4297650),
  ('day-195', 2900205),
  ('day-196', 2896005),
  ('day-197', 2248050),
  ('day-198', 2155020),
  ('day-199', 1135050),
  ('day-200', 2623215),
  ('day-201', 1921920),
  ('day-202', 2558640),
  ('day-203', 1455615),
  ('day-204', 2094750),
  ('day-205', 2255820),
  ('day-206', 4790310),
  ('day-207', 2079630),
  ('day-208', 3923010),
  ('day-209', 2817675),
  ('day-210', 1254750),
  ('day-211', 1820595),
  ('day-212', 1679685),
  ('day-213', 1711815),
  ('day-214', 3877860),
  ('day-215', 1827105),
  ('day-216', 1719165),
  ('day-217', 2916795),
  ('day-218', 2136435),
  ('day-219', 3184860),
  ('day-220', 2477580),
  ('day-221', 4606770),
  ('day-222', 2796150),
  ('day-223', 1406370),
  ('day-224', 2292885),
  ('day-225', 2864610),
  ('day-226', 2198070),
  ('day-227', 1657110),
  ('day-228', 4315500),
  ('day-229', 1243305),
  ('day-230', 2073855),
  ('day-231', 1378755),
  ('day-232', 1212435),
  ('day-233', 4083450),
  ('day-234', 2237760),
  ('day-235', 3864630),
  ('day-236', 4642260),
  ('day-237', 2014635),
  ('day-238', 2005605),
  ('day-239', 1640730),
  ('day-240', 2519790),
  ('day-241', 1604400),
  ('day-242', 1174215),
  ('day-243', 4481610),
  ('day-244', 2649465),
  ('day-245', 2541630),
  ('day-246', 1385160),
  ('day-247', 3662190),
  ('day-248', 1741740),
  ('day-249', 1227765),
  ('day-250', 3506580),
  ('day-251', 4652130),
  ('day-252', 1600305),
  ('day-253', 5213250),
  ('day-254', 1651440),
  ('day-255', 2098005),
  ('day-256', 1768725),
  ('day-257', 3163440),
  ('day-258', 1503180),
  ('day-259', 4913790),
  ('day-260', 2149770),
  ('day-261', 2231670),
  ('day-262', 4180470),
  ('day-263', 1569540),
  ('day-264', 4275390),
  ('day-265', 2250570),
  ('day-266', 2427285),
  ('day-267', 6566595),
  ('day-268', 926520),
  ('day-269', 3871350),
  ('day-270', 1253700),
  ('day-271', 2436000),
  ('day-272', 1799280),
  ('day-273', 2041410),
  ('day-274', 4837770),
  ('day-275', 1459710),
  ('day-276', 2269365),
  ('day-277', 2574390),
  ('day-278', 4568130),
  ('day-279', 1806000),
  ('day-280', 1467900),
  ('day-281', 7309050),
  ('day-282', 1556100),
  ('day-283', 3065475),
  ('day-284', 995925),
  ('day-285', 2389380),
  ('day-286', 1344945),
  ('day-287', 1490265),
  ('day-288', 894075),
  ('day-289', 1278795),
  ('day-290', 2518005),
  ('day-291', 1739325),
  ('day-292', 1858395),
  ('day-293', 2611560),
  ('day-294', 3416175),
  ('day-295', 2988615),
  ('day-296', 2258235),
  ('day-297', 1991220),
  ('day-298', 1598310),
  ('day-299', 1565970),
  ('day-300', 3544380),
  ('day-301', 2487450),
  ('day-302', 2759610),
  ('day-303', 5298090),
  ('day-304', 1559775),
  ('day-305', 2914485),
  ('day-306', 2732100),
  ('day-307', 1785000),
  ('day-308', 1440390),
  ('day-309', 994665),
  ('day-310', 2546775),
  ('day-311', 1416450),
  ('day-312', 1485960),
  ('day-313', 3037230),
  ('day-314', 1446270),
  ('day-315', 2025240),
  ('day-316', 1822905),
  ('day-317', 2073540),
  ('day-318', 1200780),
  ('day-319', 3584490),
  ('day-320', 1435035),
  ('day-321', 1894935),
  ('day-322', 1375815),
  ('day-323', 4626930),
  ('day-324', 2037420),
  ('day-325', 3306345),
  ('day-326', 5043990),
  ('day-327', 1903335),
  ('day-328', 1220835),
  ('day-329', 1735965),
  ('day-330', 2905980),
  ('day-331', 4079250),
  ('day-332', 1231335),
  ('day-333', 1609755),
  ('day-334', 2405550),
  ('day-335', 2807175),
  ('day-336', 5427240),
  ('day-337', 1438500),
  ('day-338', 1196265),
  ('day-339', 1307670),
  ('day-340', 2985255),
  ('day-341', 1406475),
  ('day-342', 1060395),
  ('day-343', 3217095),
  ('day-344', 1376025),
  ('day-345', 1260840),
  ('day-346', 2320500),
  ('day-347', 2006760),
  ('day-348', 2031225),
  ('day-349', 3750810),
  ('day-350', 2469915),
  ('day-351', 1410360),
  ('day-352', 1201935),
  ('day-353', 1477245),
  ('day-354', 2799930),
  ('day-355', 1780485),
  ('day-356', 3229170),
  ('day-357', 1710765),
  ('day-358', 1971690),
  ('day-359', 1627710),
  ('day-360', 1865220),
  ('day-361', 2136120),
  ('day-362', 1617525),
  ('day-363', 2616915),
  ('day-364', 1749720),
  ('day-365', 1651125),
  ('signal-rising', 1337805),
  ('transmission-001', 815535)
ON CONFLICT (song_id) DO UPDATE SET max_score = EXCLUDED.max_score, updated_at = now();

-- ----------------------------------------------------------------------------
-- submit_score: server-authoritative score submission
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_score(
  p_song_id text,
  p_score integer,
  p_accuracy numeric,
  p_max_combo integer,
  p_medal text,
  p_pack_rewarded boolean DEFAULT false,
  p_reward_tier text DEFAULT 'none',
  p_telemetry jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_id uuid;
  v_cap integer;
  v_medal text;
  v_accuracy numeric;
  v_tier text;
  v_record jsonb;
BEGIN
  -- Identity is bound server-side from the verified JWT. No user_id parameter
  -- is accepted, so callers cannot submit scores as anyone else.
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_song_id IS NULL OR char_length(p_song_id) = 0 OR char_length(p_song_id) > 64 THEN
    RAISE EXCEPTION 'Invalid song ID';
  END IF;

  -- Per-song theoretical max; unknown/future songs fall back to the global
  -- bound (edge-function parity) so new content never hard-breaks.
  SELECT max_score INTO v_cap FROM public.song_max_scores WHERE song_id = p_song_id;
  IF v_cap IS NULL THEN
    v_cap := 10000000;
  END IF;

  IF p_score IS NULL OR p_score <= 0 OR p_score > v_cap THEN
    RAISE EXCEPTION 'Score out of valid bounds (1 - %)', v_cap;
  END IF;

  v_accuracy := round(p_accuracy::numeric, 2);
  IF v_accuracy IS NULL OR v_accuracy < 0 OR v_accuracy > 100 THEN
    RAISE EXCEPTION 'Accuracy out of valid bounds (0.00 - 100.00)';
  END IF;

  IF p_max_combo IS NULL OR p_max_combo < 0 OR p_max_combo > 100000 THEN
    RAISE EXCEPTION 'Invalid max combo';
  END IF;

  -- Medal whitelist + plausibility vs accuracy, aligned to the CLIENT's real
  -- award thresholds (GameplayCore.tsx), not the edge function's mismatched ones.
  v_medal := upper(trim(coalesce(p_medal, 'NONE')));
  IF v_medal NOT IN ('NONE','BRONZE','SILVER','GOLD','PLATINUM') THEN
    RAISE EXCEPTION 'Invalid medal value';
  END IF;
  IF v_medal = 'PLATINUM' AND v_accuracy < 93 THEN
    RAISE EXCEPTION 'Plausibility violation: PLATINUM requires >= 93%% accuracy';
  ELSIF v_medal = 'GOLD' AND v_accuracy < 80 THEN
    RAISE EXCEPTION 'Plausibility violation: GOLD requires >= 80%% accuracy';
  ELSIF v_medal = 'SILVER' AND v_accuracy < 60 THEN
    RAISE EXCEPTION 'Plausibility violation: SILVER requires >= 60%% accuracy';
  ELSIF v_medal = 'BRONZE' AND v_accuracy < 40 THEN
    RAISE EXCEPTION 'Plausibility violation: BRONZE requires >= 40%% accuracy';
  END IF;

  v_tier := lower(trim(coalesce(p_reward_tier, 'none')));
  IF v_tier NOT IN ('none','common','enhanced','rare','epic','legendary','mythic') THEN
    v_tier := 'none';
  END IF;

  INSERT INTO public.gameplay_records
    (user_id, song_id, score, accuracy, max_combo, medal, pack_rewarded, reward_tier, telemetry)
  VALUES
    (v_user_id, p_song_id, p_score, v_accuracy, p_max_combo, v_medal,
     coalesce(p_pack_rewarded, false), v_tier, p_telemetry)
  RETURNING jsonb_build_object(
      'id', id, 'score', score, 'medal', medal,
      'accuracy', accuracy, 'timestamp', "timestamp")
    INTO v_record;

  RETURN jsonb_build_object('success', true, 'record', v_record);
END;
$func$;

-- Only signed-in users may execute; anonymous/guest users cannot submit scores
-- (the client already requires a non-anonymous user with a picked username).
REVOKE ALL ON FUNCTION public.submit_score(text, integer, numeric, integer, text, boolean, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_score(text, integer, numeric, integer, text, boolean, text, jsonb) TO authenticated;

-- ----------------------------------------------------------------------------
-- Close the direct-write bypass. After this, the only write paths are the
-- submit_score RPC above and the vault-engine edge function (service_role).
-- SELECT stays world-readable for leaderboards; DELETE-own is preserved.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own gameplay records" ON public.gameplay_records;
DROP POLICY IF EXISTS "Users can update their own gameplay records" ON public.gameplay_records;
