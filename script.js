import mapboxgl from 'mapbox-gl';
import 'bootstrap';
import './style.scss'

function toggle(el) {
  if (el.style.display == 'none') {
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}

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

function addLine(name, colour, bheight) {
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
}

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
        addLine(name, colour, bheight);
        // bheight += 10;
    }
    map.flyTo({
        bearing: Math.floor(Math.random() * (360 - 1 + 1)) + 1,
        pitch: Math.floor(Math.random() * (70.0 - 1.0 + 1.0)) + 50.0,
    });
});

map.on('load', () => {
    // Build the rail line buttons
    for (let [name, colour] of lines) {
        document.getElementById("linelist").insertAdjacentHTML('beforeend',
            `<button type="button" style="background-color: ${colour};"
                id="${encodeURIComponent(name)}" class="btn btn-outline-light active"
                aria-pressed="true"><span style="color: #f8f9fa;">${name}</span></button>`
        );
    }
    document.querySelectorAll(".btn:not(#share)").forEach(function(btn) {
        btn.onclick = function() {
            const bgcolour = btn.style.backgroundColor;
            // toggle(btn);
            if (map.getLayoutProperty(`${btn.id}-extruded`, 'visibility') === 'visible') {
                map.setLayoutProperty(`${btn.id}-extruded`, 'visibility', 'none');
                btn.style.backgroundColor = '#f8f9fa';
                btn.firstChild.style.color = bgcolour;
            } else {
                map.setLayoutProperty(btn.id + '-extruded', 'visibility', 'visible');
                btn.style.backgroundColor = lines.get(btn.textContent);
                btn.firstChild.style.color = '#f8f9fa';
            }
        }
    });
    const sharedbutton = document.getElementById('share');
    sharedbutton.onclick = function() {
        if (map.getLayer('share-extruded')) {
            map.removeLayer('share-extruded');
        //     // colour all other lines correctly
            for (let [name, colour] of lines) {
                map.setPaintProperty(`${encodeURIComponent(name)}-extruded`, 'fill-extrusion-color', colour);
            }
        } else {
            // colour all other lines grey
            for (let [name, colour] of lines) {
                map.setPaintProperty(`${encodeURIComponent(name)}-extruded`, 'fill-extrusion-color', "#A0A5A9");
            }
            // highlight shared segments
            map.addLayer({
                "filter": ["==", "shared", true],
                "id": "share-extruded",
                "type": "fill-extrusion",
                "source": "tubes",
                "paint": {
                    'fill-extrusion-color': "#ff1d8e",
                    'fill-extrusion-base': 500,
                    'fill-extrusion-height': 500 + 2,
                    'fill-extrusion-height-transition': {
                        duration: 1500,
                        delay: 1000
                    },
                    'fill-extrusion-opacity': .95,
                }
            })
        }
    };
    setTimeout(function() {
        map.flyTo({
            zoom: 14.0,
            speed: 0.2,
            curve: 1
        });
    }, 3000);
});
