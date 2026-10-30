// Sun (and moon) driven lighting: extrusion shading, sky colours and shadow offsets.
// SunCalc v2 works in degrees, with azimuth clockwise from north.
import { getMoonIllumination, getMoonPosition, getPosition, getTimes } from 'suncalc';

const LONDON = { lat: 51.5074, lng: -0.1278 };
// Below this the map switches to its night look
export const NIGHT_ALTITUDE = -6;

// Sky palettes keyed by sun altitude, interpolated in between
const SKIES = [
    { altitude: -12, sky: '#070b1f', horizon: '#1b2240', fog: '#0c0c0c' },
    { altitude: -4, sky: '#26305c', horizon: '#c1667a', fog: '#2a2233' },
    { altitude: 2, sky: '#6d8ec7', horizon: '#ffb37a', fog: '#f4d8c4' },
    { altitude: 12, sky: '#8ebff2', horizon: '#eef4fb', fog: '#f2f3f0' },
];

function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(rgb) {
    return `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

export function mix(a, b, t) {
    const [ra, rb] = [hexToRgb(a), hexToRgb(b)];
    return rgbToHex(ra.map((c, i) => c + (rb[i] - c) * t));
}

function clamp(x, lo, hi) {
    return Math.min(hi, Math.max(lo, x));
}

export function sunAt(date, { lat, lng } = LONDON) {
    return getPosition(date, lat, lng);
}

export function sunTimes(date, utcOffset, { lat, lng } = LONDON) {
    return getTimes(date, lat, lng, 0, utcOffset);
}

export function skyFor(altitude) {
    const i = SKIES.findIndex((s) => s.altitude >= altitude);
    let [a, b, t] = [SKIES[0], SKIES[0], 0];
    if (i === -1) {
        a = b = SKIES[SKIES.length - 1];
    } else if (i > 0) {
        [a, b] = [SKIES[i - 1], SKIES[i]];
        t = (altitude - a.altitude) / (b.altitude - a.altitude);
    }
    return {
        'sky-color': mix(a.sky, b.sky, t),
        'horizon-color': mix(a.horizon, b.horizon, t),
        'fog-color': mix(a.fog, b.fog, t),
        'sky-horizon-blend': 0.6,
        'horizon-fog-blend': 0.6,
        'fog-ground-blend': 0.4,
        'atmosphere-blend': 0,
    };
}

// MapLibre light position is [radial, azimuthal, polar], polar measured from the zenith
export function lightFor(date, sun, location = LONDON) {
    if (sun.altitude > 0) {
        const warmth = clamp(sun.altitude / 20, 0, 1);
        return {
            anchor: 'map',
            position: [1.5, sun.azimuth, 90 - sun.altitude],
            color: mix('#ffb06b', '#ffffff', warmth),
            intensity: 0.3 + 0.25 * warmth,
        };
    }
    // At night the moon takes over, if it's up
    const moon = getMoonPosition(date, location.lat, location.lng);
    const { fraction } = getMoonIllumination(date);
    const up = moon.altitude > 0;
    return {
        anchor: 'map',
        position: [1.5, up ? moon.azimuth : sun.azimuth, up ? 90 - moon.altitude : 80],
        color: '#9fb4ff',
        intensity: up ? 0.15 + 0.25 * fraction : 0.12,
    };
}

// Map-plane pixel offset of a shadow cast by something `height` metres up
export function shadowOffset(sun, height, zoom, lat) {
    if (sun.altitude < 3) {
        return null;
    }
    const metres = Math.min(height / Math.tan((sun.altitude * Math.PI) / 180), 8000);
    const pxPerMetre = (512 * 2 ** zoom) / (40075016.686 * Math.cos((lat * Math.PI) / 180));
    // shadows fall away from the sun; pixel y grows southward
    const away = ((sun.azimuth + 180) * Math.PI) / 180;
    return [Math.sin(away) * metres * pxPerMetre, -Math.cos(away) * metres * pxPerMetre];
}

export function shadowOpacity(sun) {
    return 0.18 * clamp((sun.altitude - 3) / 10, 0, 1);
}

// London wall-clock helpers, so the time slider means the same thing everywhere
const londonParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
});

function partsOf(date) {
    const p = Object.fromEntries(londonParts.formatToParts(date).map(({ type, value }) => [type, +value]));
    return { year: p.year, month: p.month, day: p.day, minutes: p.hour * 60 + p.minute };
}

// Minutes east of UTC for London at `date`
export function londonOffset(date) {
    const p = partsOf(date);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, 0, p.minutes);
    return Math.round((asUtc - date.getTime()) / 60000);
}

export function londonMinutes(date) {
    return partsOf(date).minutes;
}

// The instant at `minutes` past midnight on the London calendar day containing `date`
export function atLondonMinutes(date, minutes) {
    const p = partsOf(date);
    const guess = Date.UTC(p.year, p.month - 1, p.day, 0, minutes);
    return new Date(guess - londonOffset(new Date(guess)) * 60000);
}

export function formatMinutes(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatLondon(date) {
    return date ? formatMinutes(londonMinutes(date)) : '–';
}
