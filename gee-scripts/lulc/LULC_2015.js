// =====================================================================
//  LULC classification (Random Forest) - Landsat 8 OLI  |  Khulna, Bangladesh
//  Year: 2015
//
//  Faithful reproduction of the classification used in the study. Training
//  polygons (Vegetation, Build_up, Waterbody, Bare_soil, Agriculture) are
//  drawn manually in the GEE Code Editor and imported as assets/geometries
//  named accordingly before running. Classes:
//    0 = Waterbody, 1 = Built-up, 2 = Vegetation, 3 = Agriculture, 4 = Bare soil
//
//  NOTE on cross-year comparability: the NDWI definition and minor
//  post-processing differ slightly between years (documented per script and
//  in the repository README); each year's classification was validated
//  independently (confusion matrix, overall accuracy, kappa).
// =====================================================================

// ---- AOI ----
var khulna_fc = ee.FeatureCollection("projects/enduring-button-461120-u8/assets/Khulna");
var khulna = khulna_fc.geometry();
Map.centerObject(khulna, 8);
Map.addLayer(khulna, {color: 'red'}, "Khulna AOI");

// ---- Scale factors (Collection 2 Level-2) ----
function applyScaleFactors(image) {
  var optical = image.select("SR_B.*").multiply(0.0000275).add(-0.2);
  return image.addBands(optical, null, true);
}

// ---- Cloud/shadow mask (QA_PIXEL bit 3 = cloud, bit 4 = cloud shadow) ----
function cloudMask(image) {
  var qa = image.select("QA_PIXEL");
  var cloud  = qa.bitwiseAnd(1 << 3).eq(0);
  var shadow = qa.bitwiseAnd(1 << 4).eq(0);
  return image.updateMask(cloud.and(shadow));
}

// ---- Image collection ----
var landsat = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
  .filterDate("2015-01-01", "2015-12-31")
  .filterBounds(khulna);

var landsatProcessed = landsat.map(cloudMask).map(applyScaleFactors);
var annualComposite = landsatProcessed.median().clip(khulna);

// ---- Indices ----
// NDWI definition this year: Green-NIR (McFeeters NDWI)
var ndvi = annualComposite.normalizedDifference(["SR_B5", "SR_B4"]).rename("NDVI");
var ndwi = annualComposite.normalizedDifference(["SR_B3", "SR_B5"]).rename("NDWI");
var ndbi = annualComposite.normalizedDifference(["SR_B6", "SR_B5"]).rename("NDBI");

var lulcFeatures = annualComposite
  .addBands(ndvi).addBands(ndwi).addBands(ndbi);

// ---- Training data (manually drawn class polygons) ----
var trainingSamples = Vegetation.merge(Build_up).merge(Waterbody)
                                .merge(Bare_soil).merge(Agriculture);

var trainingData = lulcFeatures.sampleRegions({
  collection: trainingSamples, properties: ['Class'], scale: 30,
  geometries: false, tileScale: 4
});

// ---- Train/validation split (70/30) ----
var random = trainingData.randomColumn("random");
var trainingSet = random.filter(ee.Filter.lt("random", 0.7));
var validSet    = random.filter(ee.Filter.gte("random", 0.7));

// ---- Random Forest classifier ----
var classifier = ee.Classifier.smileRandomForest({numberOfTrees: 100}).train({
  features: trainingSet, classProperty: 'Class',
  inputProperties: lulcFeatures.bandNames()
});

// ---- Accuracy ----
var validated = validSet.classify(classifier);
var cm = validated.errorMatrix('Class', 'classification');
print('Confusion Matrix', cm);
print('Overall Accuracy', cm.accuracy());
print('Kappa', cm.kappa());
print('Producer Accuracy', cm.producersAccuracy());
print('User Accuracy', cm.consumersAccuracy());

// ---- Classify ----
var lulcMap = lulcFeatures.classify(classifier);

var finalMap = lulcMap;

// ---- Display ----
var lulcPalette = ['0000ff','ff0000','00ff00','ffff00','d2b48c'];
Map.addLayer(finalMap, {min:0, max:4, palette:lulcPalette}, "LULC 2015");

// ---- Area per class (sq km) ----
var areaImage = ee.Image.pixelArea().addBands(finalMap);
var area = areaImage.reduceRegion({
  reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'Class'}),
  geometry: khulna, scale: 60, maxPixels: 1e13, bestEffort: true, tileScale: 8
});
var areaSqKm = ee.List(area.get('groups')).map(function(item){
  item = ee.Dictionary(item);
  return ee.Dictionary({Class: item.get('Class'),
                        Area_sqkm: ee.Number(item.get('sum')).divide(1000000)});
});
print('LULC Area (sq km)', areaSqKm);

// ---- Export ----
Export.image.toDrive({
  image: finalMap, description: '2015_LULC_Khulna',
  region: khulna, scale: 30, crs: 'EPSG:32646', maxPixels: 1e13
});
