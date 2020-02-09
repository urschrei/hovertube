import babel from 'rollup-plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import postcss from 'rollup-plugin-postcss';
import { eslint } from 'rollup-plugin-eslint';

const path = require('path');

module.exports = {
  input: 'static/script.js',
  plugins: [
    eslint({
      exclude: [
        'src/styles/**',
        'static/*.scss'
      ]
    }),
    babel({
      exclude: 'node_modules/**',
      sourceMaps: true,
      inputSourceMap: true
    }),
    resolve(),
    postcss({ 
      plugins: []
    }),
    commonjs({}),
  ],
  output: {
    file: 'static/bundle.js',
    format: 'iife',
    globals: {
      'mapbox-gl': 'mapboxgl',
    }
  }
};
