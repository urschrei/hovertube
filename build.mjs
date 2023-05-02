import * as esbuild from 'esbuild'
import { sassPlugin } from "esbuild-sass-plugin";
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';

await esbuild.build({
  entryPoints: ['script.js'],
  bundle: true,
  metafile: true,
  outdir: 'static',
  plugins: [
      sassPlugin({
          async transform(source) {
              const { css } = await postcss([autoprefixer]).process(source);
              return css;
          },
      }),
  ],
})
