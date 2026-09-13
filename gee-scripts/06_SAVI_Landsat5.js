// =====================================================================
//  Soil-Adjusted Vegetation Index (SAVI) - Landsat 5 TM (Collection 2, L2)
//  Khulna, Bangladesh  |  Study years: 1990, 1995, 2000, 2005, 2010
//
//  SAVI = ((NIR - RED) * (1 + L)) / (NIR + RED + L),  L = 0.5
//  Landsat 5 TM: NIR = SR_B4, RED = SR_B3.
//  Scale factors are applied before the SAVI math.
//  Change the date range per study year before running.
// =====================================================================

// ---- AOI ----
var aoi = ee.FeatureCollection('projects/ee-tahmidkazi20170122/assets/Khulna_Projected')
            .geometry();
Map.centerObject(aoi, 12);

// ---- DATE (edit per year) ----
var startDate = '1990-01-01';
var endDate   = '1990-12-31';

// ---- Collection with scaling + cloud mask (bit 3 = cloud, bit 5 = snow) ----
var collection = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
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
    'NIR': composite.select('SR_B4'),
    'RED': composite.select('SR_B3'),
    'L': 0.5
  }).rename('SAVI').clip(aoi);

Map.addLayer(savi, {min: 0, max: 0.6, palette: ['brown','yellow','green']}, 'SAVI');

// ---- Export ----
Export.image.toDrive({
  image: savi,
  description: 'SAVI_Khulna_1990',
  folder: 'Thesis_SAVI',
  region: aoi, scale: 30, crs: 'EPSG:32646', maxPixels: 1e13,
  fileFormat: 'GeoTIFF'
});
