module.exports = function (buildOptions) {
  return {
    ...buildOptions,
    define: {
      global: 'window',
    },
    plugins: [
      ...(buildOptions.plugins || []),
      {
        name: 'css-handler',
        setup(build) {
          // Handle regular CSS files (including Tailwind output)
          build.onLoad({ filter: /output\.css$/ }, async (args) => {
            const fs = require('fs')
            const css = await fs.promises.readFile(args.path, 'utf8')
            return {
              contents: css,
              loader: 'css',
            }
          })

          // Handle CSS modules for other CSS files
          build.onLoad({ filter: /\.css$/, namespace: 'file' }, async (args) => {
            if (args.path.includes('output.css')) {
              return null // Let the previous handler deal with output.css
            }
            // Continue with default CSS modules processing for other files
            return null
          })
        },
      },
    ],
  }
}
