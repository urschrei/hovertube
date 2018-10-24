import mapboxgl from 'mapbox-gl';

let lines = new Map([
    ["Bakerloo", "#B36305"],
    ["Central", "#E32017"],
    ["Circle", "#FFD300"],
    ["District", "#00782A"],
    ["Hammersmith & City", "#F3A9BB"],
    ["Jubilee", "#A0A5A9"],
    ["Metropolitan", "#9B0056"],
    ["Northern", "#000000"],
    ["Piccadilly", "#003688"],
    ["Victoria", "#0098D4"],
    ["Waterloo & City", "#95CDBA"],
    ["DLR", "#00A4A7"],
    ["London Overground", "#EE7C0E"],
    ["Tramlink", "#84B817"],
    ["Emirates Air Line", "#E21836"],
    ["Crossrail", "#7156A5"]
]);

mapboxgl.accessToken = 'pk.eyJ1IjoidXJzY2hyZWkiLCJhIjoiY2pubHJsaGZjMWl1dzNrbzM3eDBuNzN3eiJ9.5xEWTiavcSRbv7LYZoAmUg';
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v9',
    zoom: 15.5,
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
    for (let [name, colour] of lines) {
        map.addLayer({
                "filter": ["==", "line_name", name],
                "id": encodeURIComponent(name) + "-extruded",
                "type": "fill-extrusion",
                "source": "tubes",
                "paint": {
                    'fill-extrusion-color': colour,
                    'fill-extrusion-base': bheight,
                    'fill-extrusion-height': bheight + 2,
                    'fill-extrusion-height-transition': {
                        duration: 1500,
                        delay: 1000
                    },
                    'fill-extrusion-opacity': .85,
                }
            })
            .flyTo({
                bearing: Math.floor(Math.random() * (360 - 1 + 1)) + 1,
                pitch: Math.floor(Math.random() * (70.0 - 1.0 + 1.0)) + 50.0,
            });
        bheight += 10;
    }
});

$(document).ready(function() {
    // Build the rail line buttons
    for (let [name, colour] of lines) {
        $('#linelist').append(
            `<button type="button" style="background-color: ${colour};"
                id="${encodeURIComponent(name)}" class="btn btn-outline-light active"
                aria-pressed="true"><span style="color: #f8f9fa;">${name}</span></button>`
        );
    }
    // Fiddle with button colours to make it obvious which lines are disabled/enabled
    $('.btn').click(function() {
        var bgcolour = $(this).css('backgroundColor');
        $(this).button('toggle');
        if (map.getLayoutProperty($(this).attr('id') + '-extruded', 'visibility') === 'visible') {
            map.setLayoutProperty($(this).attr('id') + '-extruded', 'visibility', 'none');
            $(this)
                .css('background-color', '#f8f9fa')
                .find(">:first-child")
                .css('color', bgcolour);
        } else {
            map.setLayoutProperty($(this).attr('id') + '-extruded', 'visibility', 'visible');
            $(this)
                .css('background-color', lines.get($(this).text()))
                .find(">:first-child")
                .css('color', '#f8f9fa');
        }
    });
    setTimeout(function() {
        map.flyTo({
            zoom: 14.0,
            speed: 0.2,
            curve: 1
        });
    }, 3000);
});
