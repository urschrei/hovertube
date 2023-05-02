import * as esbuild from 'esbuild'
import { sassPlugin } from "esbuild-sass-plugin";
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';

import eslint from 'esbuild-plugin-eslint';

import browserslist from 'browserslist';
import {
  esbuildPluginBrowserslist,
  resolveToEsbuildTarget,
} from 'esbuild-plugin-browserslist';

await esbuild.build({
  entryPoints: ['script.js'],
  bundle: true,
  minify: true,
  sourcemap: true,
  metafile: true,
  outdir: 'static',
  plugins: [
      sassPlugin({
          async transform(source) {
              const { css } = await postcss([autoprefixer]).process(source, { from: undefined });
              return css;
          },
      }),
      eslint({
        "useEslintrc": true
      }),
      esbuildPluginBrowserslist(browserslist('defaults'), {
        printUnknownTargets: false,
      }),
  ],
})
