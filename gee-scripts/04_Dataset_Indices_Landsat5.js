// =====================================================================
//  Spectral bands + indices export - Landsat 5 TM (Collection 2, Level-2)
//  Khulna, Bangladesh  |  Study years: 1990, 1995, 2000, 2005, 2010
//
//  Exports surface-reflectance bands, the Level-2 thermal band, and the
//  spectral indices (NDVI, NDBI, NDWI) as separate GeoTIFFs for LULC and
//  index analysis. SAVI is produced by a separate script (see 06_SAVI_*).
//  Landsat 5 TM bands: Green=B2, Red=B3, NIR=B4, SWIR1=B5.
//  Change the date range per study year before running.
// =====================================================================

// ---- AOI ----
var khulna = ee.FeatureCollection('projects/ee-tahmidkazi20170122/assets/Khulna_Projected');
Map.centerObject(khulna, 9);

// ---- DATE (edit per year) ----
var startDate = '1990-01-01';
var endDate   = '1990-12-31';

// ---- Scaling factors (Collection 2 Level-2) ----
function applyScaleFactors(image) {
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);
  return image.addBands(opticalBands, null, true)
              .addBands(thermalBands, null, true);
}

// ---- Cloud mask (QA_PIXEL bit 3 = cloud, bit 5 = snow) ----
function maskL5(image) {
  var qa = image.select('QA_PIXEL');
  var mask = qa.bitwiseAnd(1 << 3).eq(0)
               .and(qa.bitwiseAnd(1 << 5).eq(0));
  return image.updateMask(mask);
}

// ---- Composite ----
var image = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
  .filterBounds(khulna)
  .filterDate(startDate, endDate)
  .map(applyScaleFactors)
  .map(maskL5)
  .median()
  .clip(khulna);

// ---- Indices (Landsat 5) ----
var ndvi = image.normalizedDifference(['SR_B4', 'SR_B3']).rename('NDVI'); // (NIR-Red)/(NIR+Red)
var ndbi = image.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDBI'); // (SWIR1-NIR)/(SWIR1+NIR)
var ndwi = image.normalizedDifference(['SR_B2', 'SR_B4']).rename('NDWI'); // (Green-NIR)/(Green+NIR)
image = image.addBands([ndvi, ndbi, ndwi]);

Map.addLayer(ndvi, {min:-1, max:1, palette:['blue','white','green']}, 'NDVI', false);

// ---- Bands to export ----
var bands = ['SR_B1','SR_B2','SR_B3','SR_B4','SR_B5','SR_B7',
             'ST_B6','NDVI','NDBI','NDWI'];

bands.forEach(function(band) {
  Export.image.toDrive({
    image: image.select(band),
    description: 'Khulna_1990_' + band,
    folder: 'Khulna_Landsat5_1990',
    fileNamePrefix: 'Khulna_1990_' + band,
    region: khulna.geometry(),
    scale: 30, crs: 'EPSG:32646', maxPixels: 1e13
  });
});
