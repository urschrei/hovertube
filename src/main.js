import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import LINES from '../lines.json';
import {
    NIGHT_ALTITUDE, atLondonMinutes, formatLondon, formatMinutes, lightFor, londonMinutes,
    londonOffset, mix, shadowOffset, shadowOpacity, skyFor, sunAt, sunTimes,
} from './sun.js';

const STYLES = {
    light: 'https://tiles.openfreemap.org/styles/positron',
    dark: 'https://tiles.openfreemap.org/styles/dark',
};
const BACKGROUND = { light: '#f2f3f0', dark: '#0c0c0c' };
// Lines that vanish against the dark basemap
const NIGHT_COLOURS = { Northern: '#8c8c8c' };
const SHARED_COLOUR = '#ff1d8e';
const UNSHARED_COLOUR = '#a0a5a9';
const ATTRIBUTION = 'Lines and stations: <a href="https://github.com/oobrien/vis">Oliver O\'Brien</a> (CC BY-NC), from OpenStreetMap';

const DEFAULT_HEIGHT = 500;
const THICKNESS = 3;
// vertical spacing of lines that share track
const LEVEL_GAP = 6;
const PILLAR_RADIUS = 4;
const OURS = new Set(['tubes', 'pillars', 'stations']);

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const colours = new Map(LINES.map(({ name, colour }) => [name, colour]));
const params = new URLSearchParams(window.location.search);

const state = {
    visible: new Set(params.has('lines') ? params.get('lines').split(',').filter((n) => colours.has(n)) : colours.keys()),
    height: clampHeight(Number(params.get('height')) || DEFAULT_HEIGHT),
    shared: params.get('shared') === '1',
    stations: params.get('stations') !== '0',
    shadows: params.get('shadows') !== '0',
    basemap: ['light', 'dark'].includes(params.get('map')) ? params.get('map') : 'auto',
    // null follows the clock
    minutes: /^\d{1,2}:\d{2}$/.test(params.get('time') ?? '') ? parseClock(params.get('time')) : null,
    hovered: null,
    theme: 'light',
    levels: 1,
    touring: false,
};

function clampHeight(h) {
    return Math.min(1500, Math.max(50, h));
}

function parseClock(text) {
    const [h, m] = text.split(':').map(Number);
    return Math.min(1439, h * 60 + m);
}

const startsAtHash = window.location.hash.length > 1;
const map = new maplibregl.Map({
    container: 'map',
    style: STYLES.light,
    hash: true,
    zoom: 15.5,
    center: [-0.11598, 51.51273],
    bearing: startsAtHash ? 0 : Math.random() * 360,
    pitch: startsAtHash ? 0 : 50 + Math.random() * 20,
    maxPitch: 85,
    // the network, from Reading to Shenfield, plus a margin
    maxBounds: [[-1.1, 51.25], [0.45, 51.8]],
    attributionControl: false,
});
// On phones the panel is a bottom sheet, so keep the attribution clear of it
const narrow = window.matchMedia('(max-width: 640px)').matches;
map.addControl(new maplibregl.AttributionControl({ compact: true }), narrow ? 'top-left' : 'bottom-right');
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
map.addControl(new maplibregl.FullscreenControl(), 'top-right');
if (!narrow) {
    map.addControl(new maplibregl.ScaleControl(), 'bottom-right');
}

// Data

const dataReady = Promise.all([
    fetch('static/tube_polygons.geojson').then((r) => r.json()),
    fetch('static/stations.geojson').then((r) => r.json()),
]).then(([tubes, stations]) => {
    stations.features.forEach((f, i) => { f.properties.sid = i; });
    state.levels = Math.max(...tubes.features.map((f) => f.properties.level)) + 1;
    return { tubes, stations, pillars: pillarsFor(stations) };
});

// Station "pillars" are small extruded circles, rising from the ground to the lines
function pillarsFor(stations) {
    const features = stations.features.map(({ properties, geometry }) => {
        const [lng, lat] = geometry.coordinates;
        const dLat = PILLAR_RADIUS / 111320;
        const dLng = dLat / Math.cos((lat * Math.PI) / 180);
        const ring = Array.from({ length: 13 }, (_, i) => {
            const a = ((i % 12) / 12) * 2 * Math.PI;
            return [lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)];
        });
        return { type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [ring] } };
    });
    return { type: 'FeatureCollection', features };
}

// Style expressions

function colourFor(name) {
    return (state.theme === 'dark' && NIGHT_COLOURS[name]) || colours.get(name);
}

function lineMatch(fade) {
    const expr = ['match', ['get', 'line']];
    for (const name of colours.keys()) {
        const colour = colourFor(name);
        expr.push(name, fade ? mix(colour, BACKGROUND[state.theme], 0.75) : colour);
    }
    expr.push('#888888');
    return expr;
}

function lineColour() {
    const full = state.shared ? ['case', ['get', 'shared'], SHARED_COLOUR, UNSHARED_COLOUR] : lineMatch(false);
    if (!state.hovered) {
        return full;
    }
    const faded = state.shared
        ? ['case', ['get', 'shared'], mix(SHARED_COLOUR, BACKGROUND[state.theme], 0.6), mix(UNSHARED_COLOUR, BACKGROUND[state.theme], 0.75)]
        : lineMatch(true);
    return ['case', ['==', ['get', 'line'], state.hovered], state.shared ? full : lineMatch(false), faded];
}

function visibleFilter() {
    return ['in', ['get', 'line'], ['literal', [...state.visible]]];
}

let stationsData = null;

function stationFilter() {
    const ids = stationsData
        ? stationsData.features.filter((f) => f.properties.lines.some((l) => state.visible.has(l))).map((f) => f.properties.sid)
        : [];
    return ['in', ['get', 'sid'], ['literal', ids]];
}

function levelIds() {
    return Array.from({ length: state.levels }, (_, i) => `lines-${i}`);
}

function transition(duration, delay = 0) {
    return reducedMotion ? { duration: 0, delay: 0 } : { duration, delay };
}

// Layers

// Our layers briefly don't exist while a basemap swap is loading
function setPaint(id, prop, value) {
    if (map.getLayer(id)) {
        map.setPaintProperty(id, prop, value);
    }
}

function setFilter(id, filter) {
    if (map.getLayer(id)) {
        map.setFilter(id, filter);
    }
}

function setLayout(id, prop, value) {
    if (map.getLayer(id)) {
        map.setLayoutProperty(id, prop, value);
    }
}

function addLayers(data, startHeight) {
    map.addSource('tubes', { type: 'geojson', data: data.tubes, attribution: ATTRIBUTION });
    map.addSource('stations', { type: 'geojson', data: data.stations });
    map.addSource('pillars', { type: 'geojson', data: data.pillars });

    map.addLayer({
        id: 'shadows',
        type: 'fill',
        source: 'tubes',
        filter: visibleFilter(),
        paint: {
            'fill-color': '#000000',
            'fill-opacity': 0,
            'fill-translate-anchor': 'map',
            'fill-antialias': false,
        },
    });
    map.addLayer({
        id: 'station-dots',
        type: 'circle',
        source: 'stations',
        filter: stationFilter(),
        minzoom: 11,
        paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 1.5, 16, 5],
            'circle-color': '#ffffff',
            'circle-stroke-color': '#555555',
            'circle-stroke-width': 1,
        },
    });
    map.addLayer({
        id: 'pillars',
        type: 'fill-extrusion',
        source: 'pillars',
        filter: stationFilter(),
        paint: {
            'fill-extrusion-color': '#c4c9d0',
            'fill-extrusion-base': 0,
            'fill-extrusion-height': startHeight,
            'fill-extrusion-height-transition': transition(2500, 500),
            'fill-extrusion-opacity': 0.25,
        },
    });
    levelIds().forEach((id, level) => {
        map.addLayer({
            id,
            type: 'fill-extrusion',
            source: 'tubes',
            filter: ['all', ['==', ['get', 'level'], level], visibleFilter()],
            paint: {
                'fill-extrusion-color': lineColour(),
                'fill-extrusion-base': startHeight + level * LEVEL_GAP,
                'fill-extrusion-height': startHeight + level * LEVEL_GAP + THICKNESS,
                'fill-extrusion-base-transition': transition(2500, 500),
                'fill-extrusion-height-transition': transition(2500, 500),
                'fill-extrusion-opacity': 0.85,
            },
        });
    });
    map.addLayer({
        id: 'station-labels',
        type: 'symbol',
        source: 'stations',
        filter: stationFilter(),
        minzoom: 13,
        layout: {
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 12,
            'text-offset': [0, 0.8],
            'text-anchor': 'top',
        },
        paint: {
            'text-color': '#333333',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.5,
        },
    });
}

function setHeight(height, t = { duration: 0 }) {
    state.height = height;
    levelIds().forEach((id, level) => {
        setPaint(id, 'fill-extrusion-base-transition', t);
        setPaint(id, 'fill-extrusion-height-transition', t);
        setPaint(id, 'fill-extrusion-base', height + level * LEVEL_GAP);
        setPaint(id, 'fill-extrusion-height', height + level * LEVEL_GAP + THICKNESS);
    });
    setPaint('pillars', 'fill-extrusion-height-transition', t);
    setPaint('pillars', 'fill-extrusion-height', height);
    updateShadows(t);
}

function updateColours() {
    for (const id of levelIds()) {
        setPaint(id, 'fill-extrusion-color', lineColour());
    }
}

function updateFilters() {
    levelIds().forEach((id, level) => setFilter(id, ['all', ['==', ['get', 'level'], level], visibleFilter()]));
    setFilter('shadows', visibleFilter());
    for (const id of ['pillars', 'station-dots', 'station-labels']) {
        setFilter(id, stationFilter());
    }
}

function updateStationVisibility() {
    const v = state.stations ? 'visible' : 'none';
    for (const id of ['pillars', 'station-dots', 'station-labels']) {
        setLayout(id, 'visibility', v);
    }
}

// Paint properties of our layers that depend on the basemap
function themePaint() {
    const dark = state.theme === 'dark';
    const paint = {
        'station-labels': { 'text-color': dark ? '#d8dbe0' : '#333333', 'text-halo-color': dark ? '#0c0c0c' : '#ffffff' },
        'station-dots': { 'circle-color': dark ? '#1b1d22' : '#ffffff', 'circle-stroke-color': dark ? '#9aa0a6' : '#555555' },
        pillars: { 'fill-extrusion-color': dark ? '#b8c4ff' : '#c4c9d0', 'fill-extrusion-opacity': dark ? 0.18 : 0.25 },
    };
    for (const id of levelIds()) {
        paint[id] = { 'fill-extrusion-color': lineColour() };
    }
    return paint;
}

function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    for (const [id, props] of Object.entries(themePaint())) {
        for (const [prop, value] of Object.entries(props)) {
            setPaint(id, prop, value);
        }
    }
    renderLegend();
}

// Swap the basemap, carrying our sources and layers (restyled for the new theme) across
function setBasemap(theme) {
    if (theme === state.theme) {
        return;
    }
    state.theme = theme;
    document.documentElement.dataset.theme = theme;
    renderLegend();
    const paint = themePaint();
    map.setStyle(STYLES[theme], {
        transformStyle: (previous, next) => {
            if (!previous) {
                return next;
            }
            const sources = { ...next.sources };
            for (const id of OURS) {
                sources[id] = previous.sources[id];
            }
            const ours = previous.layers
                .filter((l) => OURS.has(l.source))
                .map((l) => ({ ...l, paint: { ...l.paint, ...paint[l.id] } }));
            return { ...next, sources, light: previous.light, sky: previous.sky, layers: [...next.layers, ...ours] };
        },
    });
}

// Sun

function currentDate() {
    const now = new Date();
    return state.minutes === null ? now : atLondonMinutes(now, state.minutes);
}

let sun = sunAt(new Date());

function updateSun() {
    const date = currentDate();
    sun = sunAt(date);
    map.setLight(lightFor(date, sun));
    map.setSky(skyFor(sun.altitude));
    updateShadows();
    const theme = state.basemap === 'auto' ? (sun.altitude < NIGHT_ALTITUDE ? 'dark' : 'light') : state.basemap;
    setBasemap(theme);

    const minutes = londonMinutes(date);
    timeInput.value = minutes;
    timeOut.textContent = `${formatMinutes(minutes)}${state.minutes === null ? ' (now)' : ''}`;
    const times = sunTimes(date, londonOffset(date));
    sunTimesOut.textContent = `Sunrise ${formatLondon(times.sunrise)} · sunset ${formatLondon(times.sunset)} · sun ${sun.altitude.toFixed(0)}°`;
}

function updateShadows(t = { duration: 0 }) {
    if (!map.getLayer('shadows')) {
        return;
    }
    const offset = state.shadows ? shadowOffset(sun, state.height, map.getZoom(), map.getCenter().lat) : null;
    setPaint('shadows', 'fill-opacity', offset ? shadowOpacity(sun) : 0);
    if (offset) {
        setPaint('shadows', 'fill-translate-transition', t);
        setPaint('shadows', 'fill-translate', offset);
    }
}

// Hover and click

const tooltip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'tooltip', maxWidth: '260px', offset: 12 });
let tubesById = new Map();

function swatch(name) {
    return `<span class="swatch" style="--c: ${colourFor(name)}"></span>`;
}

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function describeSegment(props) {
    const { line, from, to } = tubesById.get(props.fid) ?? props;
    const others = tubesById.get(props.fid)?.with ?? [];
    let where = '';
    if (from && to && from !== to) {
        where = `${escapeHtml(from)} – ${escapeHtml(to)}`;
    } else if (from || to) {
        where = `Near ${escapeHtml(from || to)}`;
    }
    const shared = others.length ? `<div class="muted">Shared with ${others.map((n) => `${swatch(n)}${escapeHtml(n)}`).join(', ')}</div>` : '';
    return `<strong>${swatch(line)}${escapeHtml(line)}</strong>${where ? `<div>${where}</div>` : ''}${shared}`;
}

function describeStation(props) {
    const station = stationsData.features[props.sid].properties;
    const lines = station.lines.map((n) => `<li>${swatch(n)}${escapeHtml(n)}</li>`).join('');
    const zone = station.zone ? ` <span class="muted">Zone ${escapeHtml(station.zone)}</span>` : '';
    return `<strong>${escapeHtml(station.name)}</strong>${zone}<ul>${lines}</ul>`;
}

function featureAt(point) {
    const layers = [...levelIds(), ...(state.stations ? ['pillars', 'station-dots'] : [])];
    return map.queryRenderedFeatures(point, { layers })[0];
}

function showTooltip(feature, lngLat) {
    const isLine = feature.layer.id.startsWith('lines-');
    tooltip.setLngLat(lngLat).setHTML(isLine ? describeSegment(feature.properties) : describeStation(feature.properties)).addTo(map);
    const hovered = isLine ? feature.properties.line : null;
    if (hovered !== state.hovered) {
        state.hovered = hovered;
        updateColours();
    }
}

function clearTooltip() {
    tooltip.remove();
    if (state.hovered) {
        state.hovered = null;
        updateColours();
    }
}

function bindPointer() {
    const hoverable = window.matchMedia('(hover: hover)').matches;
    if (hoverable) {
        map.on('mousemove', (e) => {
            const feature = featureAt(e.point);
            map.getCanvas().style.cursor = feature ? 'pointer' : '';
            if (feature) {
                showTooltip(feature, e.lngLat);
            } else {
                clearTooltip();
            }
        });
        map.getCanvas().addEventListener('mouseleave', clearTooltip);
    }
    // Touch: tap to inspect, tap elsewhere to dismiss
    map.on('click', (e) => {
        const feature = featureAt(e.point);
        if (feature) {
            showTooltip(feature, e.lngLat);
        } else {
            clearTooltip();
        }
    });
}

// Tour: a slow orbit that any interaction cancels

function tourStep() {
    if (!state.touring) {
        return;
    }
    map.easeTo({
        bearing: map.getBearing() + 40,
        pitch: Math.max(map.getPitch(), 55),
        duration: 8000,
        easing: (t) => t,
    });
}

function setTouring(on) {
    state.touring = on;
    tourButton.setAttribute('aria-pressed', String(on));
    tourButton.textContent = on ? 'Stop tour' : 'Start tour';
    if (on) {
        tourStep();
    } else {
        map.stop();
    }
}

map.on('moveend', () => {
    if (state.touring) {
        tourStep();
    }
});
map.on('movestart', (e) => {
    if (e.originalEvent && state.touring) {
        setTouring(false);
    }
});
map.on('zoom', () => updateShadows());

// Panel

const $ = (id) => document.getElementById(id);
const panel = $('panel');
const collapseButton = $('collapse');
const lineList = $('linelist');
const timeInput = $('time');
const timeOut = $('time-out');
const sunTimesOut = $('sun-times');
const heightInput = $('height');
const heightOut = $('height-out');
const tourButton = $('tour');

function renderLegend() {
    const groups = new Map();
    for (const line of LINES) {
        groups.set(line.group, [...(groups.get(line.group) ?? []), line]);
    }
    lineList.replaceChildren(...[...groups].map(([group, lines]) => {
        const section = document.createElement('div');
        section.className = 'line-group';
        section.innerHTML = `<h3>${escapeHtml(group)}</h3><ul>${lines.map(({ name }) => `
            <li>
                <button type="button" class="line" data-line="${escapeHtml(name)}" aria-pressed="${state.visible.has(name)}">
                    ${swatch(name)}<span>${escapeHtml(name)}</span>
                </button>
                <button type="button" class="only" data-only="${escapeHtml(name)}" aria-label="Show only ${escapeHtml(name)}">only</button>
            </li>`).join('')}</ul>`;
        return section;
    }));
}

function setVisible(names) {
    state.visible = new Set(names);
    for (const button of lineList.querySelectorAll('button.line')) {
        button.setAttribute('aria-pressed', String(state.visible.has(button.dataset.line)));
    }
    updateFilters();
    saveParams();
}

lineList.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) {
        return;
    }
    if (button.dataset.only) {
        setVisible([button.dataset.only]);
        return;
    }
    const name = button.dataset.line;
    // alt-click is a shortcut for "only"
    if (e.altKey) {
        setVisible([name]);
        return;
    }
    const next = new Set(state.visible);
    if (next.has(name)) {
        next.delete(name);
    } else {
        next.add(name);
    }
    setVisible(next);
});
lineList.addEventListener('mouseover', (e) => {
    const name = e.target.closest('button.line')?.dataset.line ?? null;
    if (name !== state.hovered && map.getLayer('lines-0')) {
        state.hovered = name && state.visible.has(name) ? name : null;
        updateColours();
    }
});
lineList.addEventListener('mouseleave', clearTooltip);
$('all').addEventListener('click', () => setVisible(colours.keys()));
$('none').addEventListener('click', () => setVisible([]));

function bindToggle(id, key, apply) {
    const input = $(id);
    input.checked = state[key];
    input.addEventListener('change', () => {
        state[key] = input.checked;
        apply();
        saveParams();
    });
}

function bindControls() {
    bindToggle('shared', 'shared', updateColours);
    bindToggle('stations', 'stations', updateStationVisibility);
    bindToggle('shadows', 'shadows', () => updateShadows());

    heightInput.value = state.height;
    heightOut.textContent = `${state.height} m`;
    heightInput.addEventListener('input', () => {
        heightOut.textContent = `${heightInput.value} m`;
        setHeight(Number(heightInput.value));
    });
    heightInput.addEventListener('change', saveParams);

    timeInput.addEventListener('input', () => {
        state.minutes = Number(timeInput.value);
        updateSun();
    });
    timeInput.addEventListener('change', saveParams);
    $('now').addEventListener('click', () => {
        state.minutes = null;
        updateSun();
        saveParams();
    });

    for (const radio of document.querySelectorAll('input[name="basemap"]')) {
        radio.checked = radio.value === state.basemap;
        radio.addEventListener('change', () => {
            state.basemap = radio.value;
            updateSun();
            saveParams();
        });
    }
    tourButton.addEventListener('click', () => setTouring(!state.touring));
}

function setCollapsed(collapsed) {
    panel.classList.toggle('collapsed', collapsed);
    collapseButton.setAttribute('aria-expanded', String(!collapsed));
    collapseButton.textContent = collapsed ? 'Show' : 'Hide';
}

collapseButton.addEventListener('click', () => setCollapsed(!panel.classList.contains('collapsed')));
setCollapsed(narrow);

// Non-default settings live in the query string; the camera lives in the hash
function saveParams() {
    const p = new URLSearchParams();
    if (state.visible.size !== colours.size) {
        p.set('lines', [...state.visible].join(','));
    }
    if (state.height !== DEFAULT_HEIGHT) {
        p.set('height', state.height);
    }
    if (state.minutes !== null) {
        p.set('time', formatMinutes(state.minutes));
    }
    if (state.basemap !== 'auto') {
        p.set('map', state.basemap);
    }
    if (state.shared) {
        p.set('shared', '1');
    }
    if (!state.stations) {
        p.set('stations', '0');
    }
    if (!state.shadows) {
        p.set('shadows', '0');
    }
    const query = p.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
}

// Start up

renderLegend();
bindControls();

map.once('style.load', async () => {
    const data = await dataReady;
    stationsData = data.stations;
    tubesById = new Map(data.tubes.features.map((f) => [f.properties.fid, f.properties]));
    // Lines start on the ground and rise into the sky, unless motion is unwelcome
    addLayers(data, reducedMotion ? state.height : 0);
    updateStationVisibility();
    updateSun();
    if (state.theme === 'light') {
        applyTheme();
    }
    bindPointer();
    // keep "now" current
    setInterval(() => {
        if (state.minutes === null) {
            updateSun();
        }
    }, 60000);

    if (!reducedMotion) {
        // transitions only run on a change, so let the grounded lines render first
        map.once('idle', () => setHeight(state.height, transition(2500, 500)));
        if (!startsAtHash) {
            setTimeout(() => map.flyTo({ zoom: 14, speed: 0.2, curve: 1 }), 3000);
        }
    }
});
