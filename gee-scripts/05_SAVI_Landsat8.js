// =====================================================================
//  Soil-Adjusted Vegetation Index (SAVI) - Landsat 8 (Collection 2, L2)
//  Khulna, Bangladesh  |  Study years: 2015, 2020, 2025
//
//  SAVI = ((NIR - RED) * (1 + L)) / (NIR + RED + L),  L = 0.5
//  Landsat 8 OLI: NIR = SR_B5, RED = SR_B4.
//  Scale factors are applied before the SAVI math (SAVI is not a normalized
//  ratio, so surface-reflectance scaling matters).
//  Change the date range per study year before running.
// =====================================================================

// ---- AOI ----
var aoi = ee.FeatureCollection('projects/ee-tahmidkazi20170122/assets/Khulna_Projected')
            .geometry();
Map.centerObject(aoi, 12);

// ---- DATE (edit per year) ----
var startDate = '2025-01-01';
var endDate   = '2025-12-31';

// ---- Collection with scaling + cloud mask (bit 3 = cloud, bit 5 = snow) ----
var collection = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .filterBounds(aoi)
  .filterDate(startDate, endDate)
  .map(function(img) {
    var qa = img.select('QA_PIXEL');
    var cloudMask = qa.bitwiseAnd(1 << 3).eq(0).and(qa.bitwiseAnd(1 << 5).eq(0));
    var opticalBands = img.select('SR_B.').multiply(0.0000275).add(-0.2);
    return img.addBands(opticalBands, null, true).updateMask(cloudMask);
  });

var composite = collection.median();

// ---- SAVI ----
var savi = composite.expression(
  '((NIR - RED) * (1 + L)) / (NIR + RED + L)', {
    'NIR': composite.select('SR_B5'),
    'RED': composite.select('SR_B4'),
    'L': 0.5
  }).rename('SAVI').clip(aoi);

Map.addLayer(savi, {min: 0, max: 0.6, palette: ['brown','yellow','green']}, 'SAVI');

// ---- Export ----
Export.image.toDrive({
  image: savi,
  description: 'SAVI_Khulna_2025',
  folder: 'Thesis_SAVI',
  region: aoi, scale: 30, crs: 'EPSG:32646', maxPixels: 1e13,
  fileFormat: 'GeoTIFF'
});
