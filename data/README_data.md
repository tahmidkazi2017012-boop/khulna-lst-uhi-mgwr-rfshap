# Fishnet dataset description

Each study year has a per-pixel CSV on a 500 m fishnet covering Khulna
(UTM Zone 46N, EPSG:32646), with 14,419 cells after removing missing/no-data.

## Columns
- `X_COR`, `Y_COR` : projected cell-centre coordinates (metres, EPSG:32646)
- `LST_<year>`     : land surface temperature (deg C)
- `NDVI_<year>`    : Normalized Difference Vegetation Index
- `NDBI_<year>`    : Normalized Difference Built-up Index
- `NDWI_<year>`    : Normalized Difference Water Index
- `SAVI_<year>`    : Soil-Adjusted Vegetation Index (L = 0.5)
- (some years also include UHI and UTFVI columns)

## Notes
- No-data / missing values are coded as -9999 and removed before analysis.
- Years: 1990, 1995, 2000, 2005, 2010 (Landsat 5) and 2015, 2020, 2025 (Landsat 8).
- MGWR per-pixel results (residuals, local beta, SE, t, p) are stored separately
  as MGWR_session_<year>_results.csv (exported from MGWR 2.2).
