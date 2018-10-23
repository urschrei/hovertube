// source: http://oobrien.com/2012/01/tube-colours/
lines = [
    "Bakerloo",
    "Central",
    "Circle",
    "District",
    "Hammersmith & City",
    "Jubilee",
    "Metropolitan",
    "Northern",
    "Piccadilly",
    "Victoria",
    "Waterloo & City",
    "DLR",
    "London Overground",
    "Tramlink",
    "Emirates Air Line",
    "Crossrail"
];

tube_colours = {
    "Bakerloo": "#B36305",
    "Central": "#E32017",
    "Circle": "#FFD300",
    "District": "#00782A",
    "Hammersmith & City": "#F3A9BB",
    "Jubilee": "#A0A5A9",
    "Metropolitan": "#9B0056",
    "Northern": "#000000",
    "Piccadilly": "#003688",
    "Victoria": "#0098D4",
    "Waterloo & City": "#95CDBA",
    "DLR": "#00A4A7",
    "London Overground": "#EE7C0E",
    "Tramlink": "#84B817",
    "Emirates Air Line": "#E21836",
    "Crossrail": "#7156A5"
};

mapboxgl.accessToken = 'pk.eyJ1IjoidXJzY2hyZWkiLCJhIjoiY2pubHJsaGZjMWl1dzNrbzM3eDBuNzN3eiJ9.5xEWTiavcSRbv7LYZoAmUg';
var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v9',
    zoom: 15.,
    center: {
        lng: -0.11598344692356477,
        lat: 51.512726521488304
    },
    maxBounds: [{
        'lng': -0.5533749005341804,
        'lat': 51.31536873314653
    }, {
        'lng': 0.4214032710438005,
        'lat': 51.71445426713464
    }]
});

map.on('style.load', function() {
    map
        .addSource(
            "tubes", {
                type: 'geojson',
                data: "static/tube_polygons.geojson"
            });
    var bheight = 500;
    lines.forEach(function(line) {
        map.addLayer({
                "filter": ["==", "line_name", line],
                "id": encodeURIComponent(line) + "-extruded",
                "type": "fill-extrusion",
                "source": "tubes",
                "paint": {
                    'fill-extrusion-color': tube_colours[line],
                    'fill-extrusion-base': bheight,
                    'fill-extrusion-height': bheight + 2,
                    'fill-extrusion-height-transition': {
                        duration: 1500,
                        delay: 1000
                    },
                    'fill-extrusion-opacity': .75,
                }
                //     "filter": ["==", "line_name", line],
                //     "id": line + "-extruded",
                //     "type": "line",
                //     "source": "tubes",
                //     'paint': {
                //         "line-width": 1.5,
                //         'line-color': tube_colours[line],
                //         'line-opacity': 0.75
                //     }
            })
            .flyTo({
                bearing: Math.floor(Math.random() * (360 - 1 + 1)) + 1,
                pitch: Math.floor(Math.random() * (70.0 - 1.0 + 1.0)) + 50.0,
            });
        bheight += 10;
    });
});

$(document).ready(function() {
    lines.forEach(function(line) {
        var btn = '<button type="button" id=' + encodeURIComponent(line) + ' class="btn btn-outline-dark active"><span style="color: ' + tube_colours[line] + ';">' + line + '</span></button>';
        $('#linelist').append(btn);
    })
    $('.btn').click(function() {
        $(this).button('toggle');
        if (map.getLayoutProperty($(this).attr('id') + '-extruded', 'visibility') === 'visible') {
            map.setLayoutProperty($(this).attr('id') + '-extruded', 'visibility', 'none');
        } else {
            map.setLayoutProperty($(this).attr('id') + '-extruded', 'visibility', 'visible');
        }
    });
});
