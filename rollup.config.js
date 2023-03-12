// import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import eslint from '@rollup/plugin-eslint';
import scss from 'rollup-plugin-scss';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

import pkg from './package.json' assert { type: 'json' };
const banner = `
/*!
 * ${pkg.name} v${pkg.version}
 * Copyright ${pkg.author}
 * @link https://github.com/ionaru/easy-markdown-editor
 * license ${pkg.license}
 */
`;

export default {
    input: 'src/js/easymde.js',
    output: {
        format: 'iife',
        file: 'dist/easymde.min.js',
        name: 'EasyMDE',
        assetFileNames: '[name][extname]',
        banner,
    },
    plugins: [
        eslint({ throwOnError: true }),
        // typescript(), // TODO: typescriptify
        terser(),
        scss({
            fileName: 'easymde.min.css',
            outputStyle: 'compressed',
            prefix: banner,
        }),
        nodeResolve({ browser: true }),
        commonjs(),
    ],
};
