import babel from 'rollup-plugin-babel';
import uglify from 'rollup-plugin-uglify';

module.exports = {
  input: 'static/script.js',
  plugins: [
    babel({
      exclude: 'node_modules/**'
    }),
    uglify.uglify()
  ],
  output: {
    file: 'static/bundle.js',
    format: 'iife',
    sourceMap: 'inline',
  }
};
