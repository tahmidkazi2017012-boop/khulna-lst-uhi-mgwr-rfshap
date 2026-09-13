// =====================================================================
//  Land Surface Temperature (LST) - Landsat 5 TM (Collection 2, Level-2)
//  Khulna, Bangladesh  |  Study years processed: 1990, 1995, 2000, 2005, 2010
//
//  METHOD:
//  The Collection 2 Level-2 thermal band (ST_B6) is an atmospherically-
//  and emissivity-corrected surface temperature product (USGS single-channel
//  algorithm). It is used DIRECTLY: rescaled to Kelvin with the Collection 2
//  scaling factors and converted to degrees Celsius. No additional emissivity
//  correction is applied.
//
//  Landsat 5 TM bands: Blue=B1, Green=B2, Red=B3, NIR=B4, SWIR1=B5, SWIR2=B7,
//  Thermal=ST_B6. Change the date range per study year before running.
// =====================================================================

// ---- AOI ----
var aoi = ee.FeatureCollection('projects/ee-tahmidkazi20170122/assets/Khulna_Projected')
            .geometry();
Map.centerObject(aoi, 10);

// ---- DATE (edit per year) ----
var startDate = '2000-01-01';
var endDate   = '2000-12-31';

// ---- Scaling factors (Collection 2 Level-2) ----
function applyScaleFactors(image) {
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0); // -> Kelvin
  return image.addBands(opticalBands, null, true)
              .addBands(thermalBands, null, true);
}

// ---- Cloud mask (QA_PIXEL bit 3 = cloud, bit 5 = snow; snow-free study area) ----
function maskL5sr(col) {
  var qa = col.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(1 << 3).eq(0)
               .and(qa.bitwiseAnd(1 << 5).eq(0));
  return col.updateMask(mask);
}

// ---- Composite ----
var image = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
  .filterDate(startDate, endDate)
  .filterBounds(aoi)
  .map(applyScaleFactors)
  .map(maskL5sr)
  .median()
  .clip(aoi);

// ---- LST: ST_B6 used directly (Kelvin -> Celsius) ----
var thermal = image.select('ST_B6').rename('thermal');
var lst = thermal.subtract(273.15).rename('LST').clip(aoi);

var lst_vis = {min: 20, max: 45,
  palette: ['040274','2c7bb6','abd9e9','ffffbf','fdae61','d7191c']};
Map.addLayer(lst, lst_vis, 'Raw LST');

// ---- P2-P98 outlier filter ----
var pct = lst.reduceRegion({
  reducer: ee.Reducer.percentile([2, 98]),
  geometry: aoi, scale: 30, maxPixels: 1e13, bestEffort: true
});
var p2  = ee.Number(pct.get('LST_p2'));
var p98 = ee.Number(pct.get('LST_p98'));
print('P2 & P98 LST:', p2, p98);

var lst_filtered = lst.updateMask(lst.gte(p2).and(lst.lte(p98)));
Map.addLayer(lst_filtered, lst_vis, 'Filtered LST (P2-P98)');

print('Filtered LST Min/Max (C):', lst_filtered.reduceRegion({
  reducer: ee.Reducer.minMax(), geometry: aoi, scale: 30, maxPixels: 1e13}));

// ---- Export ----
Export.image.toDrive({
  image: lst_filtered,
  description: 'LST_L5_Filtered',
  folder: 'GEE_LST',
  region: aoi, scale: 30, crs: 'EPSG:32646', maxPixels: 1e13
});
