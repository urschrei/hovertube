import babel from 'rollup-plugin-babel';

module.exports = {
  input: 'static/script.js',
  plugins: [
    babel({
      exclude: 'node_modules/**'
    })
  ],
  output: {
    file: 'static/bundle.js',
    format: 'cjs'
  }
};
