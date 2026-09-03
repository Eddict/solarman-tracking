-- SELECT * FROM solar_tracking.energy_samples_minute AS esm
-- WHERE production_w <> 0
-- ORDER BY recorded_at


-- SELECT
--     id,
--     station_id,
--     recorded_at,
--     production_w,
--     consumption_w,
--     battery_soc,
--     battery_power_w,
--     grid_import_w,
--     grid_export_w,
--     battery_charge_w,
--     battery_discharge_w,
--     irradiance,
--     created_at
-- FROM
--   solar_tracking.energy_samples_minute;

-- SELECT COUNT(0)
-- FROM
--   solar_tracking.energy_samples_minute;

SELECT
  DATE(recorded_at) AS date,
  SUM(production_w) AS total_production_w,
  COUNT(DATE(recorded_at)) AS total_samples
FROM
  solar_tracking.energy_samples_minute
WHERE recorded_at >= '2014-01-01 00:00:00'
  -- AND production_w <> 0
GROUP BY DATE(recorded_at)
ORDER BY DATE(recorded_at);
