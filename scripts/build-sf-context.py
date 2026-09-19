"""Fetch DataSF's public-domain footprints from its published ArcGIS mirror.
Only surrounding visual massing is produced; never used for robot collisions.
"""
import argparse, hashlib, json, math, pathlib, urllib.parse, urllib.request

ENDPOINT = 'https://services5.arcgis.com/wXYNaciObHUosEnt/ArcGIS/rest/services/Rooftop_Solar_Power_Potential_San_Francisco_WFL1/FeatureServer/9'
PARAMS = {'f': 'json', 'where': '1=1', 'geometry': '-122.4355,37.7735,-122.4300,37.7775', 'geometryType': 'esriGeometryEnvelope', 'inSR': 4326, 'outSR': 4326, 'outFields': 'OBJECTID,sf16_BldgID,gnd_Min_m,hgt_Median_m,peak_1st_m,Shape__Area', 'returnGeometry': 'true', 'resultRecordCount': 2000}
parser = argparse.ArgumentParser(); parser.add_argument('--cached', type=pathlib.Path); args = parser.parse_args()
url = ENDPOINT + '/query?' + urllib.parse.urlencode(PARAMS)
raw = args.cached.read_bytes() if args.cached else urllib.request.urlopen(url, timeout=45).read()
data = json.loads(raw)
if data.get('error') or data.get('exceededTransferLimit'): raise ValueError('Failed or truncated footprint query')
# x follows Steiner southbound; y points across the street to the houses.
# Approximate local alignment with the authored foreground, not a survey control point.
lon0, lat0, elevation0 = -122.43278, 37.77625, 64.8
angle = math.radians(9)
def local(point):
    east = math.radians(point[0] - lon0) * 6378137 * math.cos(math.radians(lat0))
    north = math.radians(point[1] - lat0) * 6378137
    return [round(-east*math.sin(angle)-north*math.cos(angle), 3), round(east*math.cos(angle)-north*math.sin(angle)+31.75, 3)]
# These seven footprints are represented by the detailed, authored hero architecture.
hero_ids = [52851, 110065, 109792, 112685, 112735, 93068, 105612]
records, hero = [], []
for f in data['features']:
    a = f['attributes']; ground, height = a['gnd_Min_m'], a['hgt_Median_m']
    if ground is None or height is None or not math.isfinite(ground+height) or height <= 0: continue
    record = {'id': a['sf16_BldgID'], 'base': round(ground-elevation0,3), 'height': height, 'rings': [[local(p) for p in ring] for ring in f['geometry']['rings']]}
    if a['OBJECTID'] in hero_ids:
        hero.append({'index': hero_ids.index(a['OBJECTID']), 'id': record['id'], 'base': record['base'], 'height': height})
    else: records.append(record)
output = pathlib.Path(__file__).resolve().parents[1] / 'public/assets/neighborhood'
output.mkdir(parents=True, exist_ok=True)
asset = {'origin': {'longitude': lon0, 'latitude': lat0, 'elevationMetersNAVD88': elevation0, 'rotationDegrees': 9, 'yOffsetMeters':31.75}, 'hero': sorted(hero,key=lambda v:v['index']), 'buildings': records}
blob = json.dumps(asset,separators=(',',':')).encode(); (output/'buildings.json').write_bytes(blob)
source = {'source': ENDPOINT, 'query': url, 'catalog': 'https://catalog.data.gov/dataset/building-footprints-file-geodatabase-format', 'license': 'PDDL-1.0', 'licenseURL': 'https://opendatacommons.org/licenses/pddl/1-0/', 'attribution': 'City and County of San Francisco, San Francisco Open Data Program, Enterprise GIS Program, Department of Environment and Department of Technology', 'sourceFeatureCount': len(data['features']), 'renderedContextCount': len(records), 'sha256': hashlib.sha256(blob).hexdigest(), 'units': 'Meters. Height is hgt_Median_m, base is gnd_Min_m minus 64.8m NAVD88.', 'limitations': '2010-era footprint geometry with LiDAR-derived elevations, not current textured reconstruction. Local alignment and facade/roof appearances are approximations. Footprints extruded to median height do not reconstruct roof shapes. No robot collision changes.'}
(output/'SOURCE.json').write_text(json.dumps(source,indent=2)+'\n')
print(json.dumps({'contextBuildings':len(records),'heroElevations':asset['hero'],'bytes':len(blob)}))
