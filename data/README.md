# Source data

`tfl_lines.json` and `tfl_stations.json` are from Oliver O'Brien's
[vis](https://github.com/oobrien/vis/tree/master/tubecreature/data) repository
(fetched October 2026). They are derived from OpenStreetMap (ODbL) and, with his
edits, licensed **CC BY-NC**.

`npm run data` (which runs `scripts/process_lines.py`) turns them into
`static/tube_polygons.geojson` and `static/stations.geojson`.
