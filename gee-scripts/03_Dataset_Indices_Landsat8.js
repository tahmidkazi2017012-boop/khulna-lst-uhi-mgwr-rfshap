// =====================================================================
//  Spectral bands + indices export - Landsat 8 (Collection 2, Level-2)
//  Khulna, Bangladesh  |  Study years: 2015, 2020, 2025
//
//  Exports surface-reflectance bands, the Level-2 thermal band, and the
//  spectral indices (NDVI, NDWI, NDBI) as separate GeoTIFFs for LULC and
//  index analysis. SAVI is produced by a separate script (see 05_SAVI_*).
//  Landsat 8 OLI bands: Green=B3, Red=B4, NIR=B5, SWIR1=B6.
//  Change the date range per study year before running.
// =====================================================================

// ---- AOI ----
var khulna = ee.FeatureCollection('projects/ee-tahmidkazi20170122/assets/Khulna_Projected');
Map.centerObject(khulna, 9);

// ---- DATE (edit per year) ----
var startDate = '2015-01-01';
var endDate   = '2015-12-31';

// ---- Scaling factors (Collection 2 Level-2) ----
function applyScaleFactors(image) {
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);
  return image.addBands(opticalBands, null, true)
              .addBands(thermalBands, null, true);
}

// ---- Cloud mask (QA_PIXEL bit 3 = cloud, bit 5 = snow) ----
function maskL8(image) {
  var qa = image.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(1 << 3).eq(0)
               .and(qa.bitwiseAnd(1 << 5).eq(0));
  return image.updateMask(mask);
}

// ---- Composite ----
var image = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .filterBounds(khulna)
  .filterDate(startDate, endDate)
  .map(applyScaleFactors)
  .map(maskL8)
  .median()
  .clip(khulna);

// ---- Indices (Landsat 8) ----
var ndvi = image.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI'); // (NIR-Red)/(NIR+Red)
var ndwi = image.normalizedDifference(['SR_B3', 'SR_B5']).rename('NDWI'); // (Green-NIR)/(Green+NIR)
var ndbi = image.normalizedDifference(['SR_B6', 'SR_B5']).rename('NDBI'); // (SWIR1-NIR)/(SWIR1+NIR)
image = image.addBands([ndvi, ndwi, ndbi]);

Map.addLayer(ndvi, {min:-1, max:1, palette:['blue','white','green']}, 'NDVI', false);

// ---- Bands to export ----
var bands = ['SR_B1','SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','SR_B7',
             'ST_B10','NDVI','NDWI','NDBI'];

bands.forEach(function(band) {
  Export.image.toDrive({
    image: image.select(band),
    description: 'Khulna_2015_' + band,
    folder: 'Khulna_Landsat8_2015',
    fileNamePrefix: 'Khulna_2015_' + band,
    region: khulna.geometry(),
    scale: 30, crs: 'EPSG:32646', maxPixels: 1e13
  });
});
