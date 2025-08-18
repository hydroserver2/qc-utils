import { resolve } from 'path';
import { defineConfig } from 'vite';
// import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'prod';
  const isDev = mode === 'dev';
  const isTest = mode === 'test';

  // TODO: get build to emit types
  
  let build = {};
  if (isProd) {
    build = {
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: '@uwrl/qc-utils',
        fileName: 'index',
      },
      // sourcemap: true,
      rollupOptions: {
        /**
         * DESC:
         * make sure to externalize deps that shouldn't be bundled
         * into your library
         */
        output: {
          /**
           * DESC:
           * Provide global variables to use in the UMD build
           * for externalized deps
           */
          globals: {
            // vue: 'Vue',
            // vuetify: 'Vuetify',
            // 'vue-facing-decorator': 'vueFacingDecorator',
          },
        },
      },
    };
  }

  // let optimizeDeps = {
  //   include: [],
  // };
  if (isDev) {
    /**
     * DESC:
     * dependency pre-bundling
     */
  }

  let test = {};
  if (isTest) {
    /**
     * DESC:
     * vitest config
     */
    test = {
      include: ['test/**/*.test.ts'],
      coverage: {
        reporter: ['text', 'text-summary', 'lcov'],
      },
    };
  }

  return {
    // plugins: [
    //   visualizer(),
    // ],
    // optimizeDeps,
    build,
    test,

    /**
     * DESC:
     * defining aliases
     */
    resolve: {
      alias: [
        {
          find: '@',
          replacement: resolve(__dirname, './src'),
        },
      ],
    },
  };
});
