# /// script
# requires-python = ">=3.10"
# dependencies = ["shapely>=2", "pyproj>=3"]
# ///
"""
Build the extrudable line polygons and the station points from Ollie O'Brien's
TfL data (https://github.com/oobrien/vis/tree/master/tubecreature/data).

    uv run scripts/process_lines.py

MapLibre can only extrude polygons, so each line segment is buffered. A segment
used by several lines is emitted once per line, with a `level` so the lines can
be stacked rather than drawn on top of one another.
"""

import argparse
import json
import re
from datetime import date
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Point, mapping, shape
import shapely
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parent.parent
# metres, in the British National Grid
HALF_WIDTH = 8
SIMPLIFY = 0.5
# how far a segment end may be from the station it serves. Large interchanges
# need the generous value; it's only used to assign Overground lines to stations
STATION_SNAP = 250
OVERGROUND_SNAP = 450
# stations with the same name closer than this are merged
STATION_MERGE = 400

_to_bng = Transformer.from_crs(4326, 27700, always_xy=True).transform
_to_wgs = Transformer.from_crs(27700, 4326, always_xy=True).transform


def to_grid(geom):
    return shapely.transform(geom, _to_bng, interleaved=False)


def to_lonlat(geom):
    return shapely.transform(geom, _to_wgs, interleaved=False)

# The source data predates the November 2024 split of London Overground into
# six named lines, so assign them by segment id. Order matters: first match wins.
OVERGROUND = [
    ("NorthLonLineF", ["Mildmay", "Windrush"]),  # Canonbury - Highbury & Islington
    ("EmersonPark", ["Liberty"]),
    ("BakerlooDC", ["Lioness"]),
    ("EustonSpur", ["Lioness"]),
    ("WatfordJ", ["Lioness"]),
    ("Goblin", ["Suffragette"]),
    ("BarkingExt", ["Suffragette"]),
    ("LeaValleyLine", ["Weaver"]),
    ("LivStBeth", ["Weaver"]),
    ("EnfieldTownSpur", ["Weaver"]),
    ("ChingfordSpur", ["Weaver"]),
    ("EastLon", ["Windrush"]),
    ("ShoreditchRetained", ["Windrush"]),
    ("NewCrossSpur", ["Windrush"]),
    ("CrystalPSpur", ["Windrush"]),
    ("SouthLonLine", ["Windrush"]),
    ("BatterseaParkSpur", ["Windrush"]),
    ("NorthLonLine", ["Mildmay"]),
    ("WestLonLine", ["Mildmay"]),
    ("WestBrompton", ["Mildmay"]),
    ("Olympia", ["Mildmay"]),
    ("ClaphamJunctionCombo", ["Mildmay"]),
    ("DistRichmond", ["Mildmay"]),
]
OVERGROUND_LINES = {name for _, names in OVERGROUND for name in names}


def overground(fid):
    for prefix, names in OVERGROUND:
        if fid.startswith(prefix):
            return names
    raise ValueError(f"No Overground line for segment {fid}")


def is_current(entry, year):
    """Drop proposed (incl. the 9999 placeholder) and closed services"""
    opened, closed = entry.get("opened"), entry.get("closed")
    return (opened is None or opened <= year) and (closed is None or closed > year)


def current_lines(entries, fid, year, known):
    names = []
    for entry in entries:
        if not is_current(entry, year):
            continue
        name = entry["name"]
        expanded = overground(fid) if name == "London Overground" else [name]
        names.extend(n for n in expanded if n in known and n not in names)
    return names


def clean_name(name):
    return re.sub(r"\s*\((Rail|Tram|DLR( \d)?)\)$", "", name)


def load_stations(path, year, known):
    """Station points in BNG, merged by name, with their current lines"""
    merged = []
    for feature in json.loads(path.read_text())["features"]:
        props = feature["properties"]
        lines = [
            entry["name"]
            for entry in props.get("lines", [])
            if is_current(entry, year)
            and (entry["name"] in known or entry["name"] == "London Overground")
        ]
        if not lines:
            continue
        name = clean_name(props["name"])
        point = to_grid(shape(feature["geometry"]))
        match = next(
            (s for s in merged if s["name"] == name and s["points"][0].distance(point) < STATION_MERGE),
            None,
        )
        if match:
            match["points"].append(point)
            match["lines"].extend(n for n in lines if n not in match["lines"])
        else:
            merged.append({"name": name, "zone": props.get("zone"), "points": [point], "lines": lines})
    return merged


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--year", type=int, default=date.today().year, help="show the network as of this year")
    args = parser.parse_args()

    order = [line["name"] for line in json.loads((ROOT / "lines.json").read_text())]
    rank = {name: i for i, name in enumerate(order)}
    stations = load_stations(ROOT / "data/tfl_stations.json", args.year, set(order))
    # index every source point, since merged stations can be spread out
    station_points, station_index = [], []
    for i, station in enumerate(stations):
        station_points.extend(station["points"])
        station_index.extend([i] * len(station["points"]))
    station_tree = STRtree(station_points)

    def nearest_station(point, snap=STATION_SNAP):
        j = station_tree.nearest(point)
        if station_points[j].distance(point) <= snap:
            return station_index[j]
        return None

    def station_name(point):
        i = nearest_station(point)
        return None if i is None else stations[i]["name"]

    polygons = []
    served = {}  # station index -> Overground lines whose segments end there
    for feature in json.loads((ROOT / "data/tfl_lines.json").read_text())["features"]:
        fid = feature["properties"]["id"]
        lines = current_lines(feature["properties"]["lines"], fid, args.year, rank)
        if not lines:
            continue
        lines.sort(key=rank.get)
        line = to_grid(shape(feature["geometry"]))
        ends = [Point(line.coords[0]), Point(line.coords[-1])]
        for end in ends:
            i = nearest_station(end, OVERGROUND_SNAP)
            if i is not None:
                served.setdefault(i, set()).update(n for n in lines if n in OVERGROUND_LINES)
        polygon = to_lonlat(line.buffer(HALF_WIDTH).simplify(SIMPLIFY))
        for level, name in enumerate(lines):
            polygons.append({
                "type": "Feature",
                "properties": {
                    "fid": f"{fid}/{name}",
                    "line": name,
                    "level": level,
                    "shared": len(lines) > 1,
                    "with": [n for n in lines if n != name],
                    "from": station_name(ends[0]),
                    "to": station_name(ends[1]),
                },
                "geometry": mapping(polygon),
            })

    points = []
    for i, station in enumerate(stations):
        lines = [n for n in station["lines"] if n != "London Overground"]
        if "London Overground" in station["lines"]:
            lines.extend(sorted(served.get(i, set()) - set(lines), key=rank.get))
        if not lines:
            continue
        xs = [p.x for p in station["points"]]
        ys = [p.y for p in station["points"]]
        centre = to_lonlat(Point(sum(xs) / len(xs), sum(ys) / len(ys)))
        points.append({
            "type": "Feature",
            "properties": {"name": station["name"], "zone": station["zone"], "lines": sorted(lines, key=rank.get)},
            "geometry": mapping(centre),
        })

    write(ROOT / "static/tube_polygons.geojson", polygons)
    write(ROOT / "static/stations.geojson", points)
    print(f"{len(polygons)} line polygons, {len(points)} stations, network as of {args.year}")
    missing = set(order) - {p["properties"]["line"] for p in polygons}
    if missing:
        print(f"Warning: no segments for {sorted(missing)}")


def write(path, features):
    def rounded(value):
        if isinstance(value, float):
            return round(value, 6)
        if isinstance(value, (list, tuple)):
            return [rounded(v) for v in value]
        if isinstance(value, dict):
            return {k: rounded(v) for k, v in value.items()}
        return value

    collection = {"type": "FeatureCollection", "features": rounded(features)}
    path.write_text(json.dumps(collection, separators=(",", ":"), ensure_ascii=False))


if __name__ == "__main__":
    main()
