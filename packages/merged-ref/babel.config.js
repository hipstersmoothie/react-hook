module.exports = (api) => {
  const module = api.env('module')
  const esm = api.env('esm')
  const presetEnv = [
    '@lunde/es',
    {
      env: {
        modules: esm || module ? false : 'commonjs',
        targets: module
          ? {
              browsers: 'cover 80% in US',
            }
          : {
              node: esm ? '12' : '10',
            },
      },
      restSpread: false,
      devExpression: false,
      objectAssign: false,
    },
  ]

  return {
    presets: [['@babel/preset-react', {useSpread: true}], presetEnv],
    plugins: ['optimize-react', 'annotate-pure-calls'],
  }
}
