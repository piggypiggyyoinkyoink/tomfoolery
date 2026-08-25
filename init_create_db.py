import json, sqlite3, os
from get_county import get_county_from_coordinates

file = open("placenames.geojson", "r", encoding="utf-8")
data = json.load(file)
features = data["features"]
print(len(features))
if not os.path.exists("data.db"):
    con = sqlite3.connect("data.db")
    cur = con.cursor()
    cur.execute("CREATE TABLE data (lat REAL, lon REAL, name TEXT, name_norm TEXT, type TEXT, county TEXT)")
    con.commit()
    for feature in features:
        properties = feature["properties"]
        name = properties.get("name", None)
        name_en = properties.get("name:en", None)
        name_cy = properties.get("name:cy", None)
        name_ga = properties.get("name:ga", None)
        name_gd = properties.get("name:gd", None)
        name_sco = properties.get("name:sco", None)
        alt_name = properties.get("alt_name", None)
        alt_name_en = properties.get("alt_name:en", None)
        alt_name_cy = properties.get("alt_name:cy", None)
        alt_name_ga = properties.get("alt_name:ga", None)
        alt_name_gd = properties.get("alt_name:gd", None)
        alt_name_sco = properties.get("alt_name:sco", None)

        name_norm = "//".join(filter(None, [name, name_en, name_cy, name_ga, name_gd, name_sco, alt_name, alt_name_en, alt_name_cy, alt_name_ga, alt_name_gd, alt_name_sco]))
        name_norm = "//"+name_norm+"//"
        name_norm = name_norm.replace(" ", "").replace("-", "").replace("'", "").replace(".", "").replace("(", "").replace(")", "").replace(",", "").lower()

        typ = properties.get("place", None)

        geometry = feature.get("geometry", None)
        if geometry:
            coordinates = geometry.get("coordinates", None)
            if coordinates:
                lon, lat = coordinates
                county = get_county_from_coordinates(lat, lon)
                cur.execute("INSERT INTO data (lat, lon, name, name_norm, type, county) VALUES (?, ?, ?, ?, ?, ?)", (lat, lon, name, name_norm, typ, county))
                con.commit()
    cur.close()
    con.close()
else:
    print("data.db already exists, exiting.")
