import babel from 'rollup-plugin-babel';
import uglify from 'rollup-plugin-uglify';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

module.exports = {
  input: 'static/script.js',
  plugins: [
    babel({
      exclude: 'node_modules/**'
    }),
    uglify.uglify(),
    resolve(),
    commonjs()
  ],
  output: {
    file: 'static/bundle.js',
    format: 'iife',
    sourceMap: 'inline',
    globals: {'mapbox-gl': 'mapboxgl'}
  }
};
