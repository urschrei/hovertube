'use strict';

function _slicedToArray(arr, i) {
  return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest();
}

function _arrayWithHoles(arr) {
  if (Array.isArray(arr)) return arr;
}

function _iterableToArrayLimit(arr, i) {
  var _arr = [];
  var _n = true;
  var _d = false;
  var _e = undefined;

  try {
    for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
      _arr.push(_s.value);

      if (i && _arr.length === i) break;
    }
  } catch (err) {
    _d = true;
    _e = err;
  } finally {
    try {
      if (!_n && _i["return"] != null) _i["return"]();
    } finally {
      if (_d) throw _e;
    }
  }

  return _arr;
}

function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance");
}

var lines = new Map([["Bakerloo", "#B36305"], ["Central", "#E32017"], ["Circle", "#FFD300"], ["District", "#00782A"], ["Hammersmith & City", "#F3A9BB"], ["Jubilee", "#A0A5A9"], ["Metropolitan", "#9B0056"], ["Northern", "#000000"], ["Piccadilly", "#003688"], ["Victoria", "#0098D4"], ["Waterloo & City", "#95CDBA"], ["DLR", "#00A4A7"], ["London Overground", "#EE7C0E"], ["Tramlink", "#84B817"], ["Emirates Air Line", "#E21836"], ["Crossrail", "#7156A5"]]);
mapboxgl.accessToken = 'pk.eyJ1IjoidXJzY2hyZWkiLCJhIjoiY2pubHJsaGZjMWl1dzNrbzM3eDBuNzN3eiJ9.5xEWTiavcSRbv7LYZoAmUg';
var map = new mapboxgl.Map({
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
map.on('style.load', function () {
  map.addSource("tubes", {
    type: 'geojson',
    data: "static/tube_polygons.geojson"
  });
  var bheight = 500;
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = lines[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var _step$value = _slicedToArray(_step.value, 2),
          name = _step$value[0],
          colour = _step$value[1];

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
          'fill-extrusion-opacity': .85
        }
      }).flyTo({
        bearing: Math.floor(Math.random() * (360 - 1 + 1)) + 1,
        pitch: Math.floor(Math.random() * (70.0 - 1.0 + 1.0)) + 50.0
      });
      bheight += 10;
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return != null) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }
});
$(document).ready(function () {
  // Build the rail line buttons
  var _iteratorNormalCompletion2 = true;
  var _didIteratorError2 = false;
  var _iteratorError2 = undefined;

  try {
    for (var _iterator2 = lines[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
      var _step2$value = _slicedToArray(_step2.value, 2),
          name = _step2$value[0],
          colour = _step2$value[1];

      $('#linelist').append("<button type=\"button\" style=\"background-color: ".concat(colour, ";\"\n                id=\"").concat(encodeURIComponent(name), "\" class=\"btn btn-outline-light active\"\n                aria-pressed=\"true\"><span style=\"color: #f8f9fa;\">").concat(name, "</span></button>"));
    } // Fiddle with button colours to make it obvious which lines are disabled/enabled

  } catch (err) {
    _didIteratorError2 = true;
    _iteratorError2 = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion2 && _iterator2.return != null) {
        _iterator2.return();
      }
    } finally {
      if (_didIteratorError2) {
        throw _iteratorError2;
      }
    }
  }

  $('.btn').click(function () {
    var bgcolour = $(this).css('backgroundColor');
    $(this).button('toggle');

    if (map.getLayoutProperty($(this).attr('id') + '-extruded', 'visibility') === 'visible') {
      map.setLayoutProperty($(this).attr('id') + '-extruded', 'visibility', 'none');
      $(this).css('background-color', '#f8f9fa').find(">:first-child").css('color', bgcolour);
    } else {
      map.setLayoutProperty($(this).attr('id') + '-extruded', 'visibility', 'visible');
      $(this).css('background-color', lines.get($(this).text())).find(">:first-child").css('color', '#f8f9fa');
    }
  });
  setTimeout(function () {
    map.flyTo({
      zoom: 14.0,
      speed: 0.2,
      curve: 1
    });
  }, 3000);
});
