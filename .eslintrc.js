module.exports = {
    root: true,
    parser: 'babel-eslint',
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
    },
    env: {
        browser: true,
        node: true
    },
  extends: 'standard',
    globals: {
        __static: true
    },
    plugins: [
        'html'
    ],
    'rules': {
        'camelcase':0,
        'space-before-function-paren': 0,
        // allow paren-less arrow functions
        'arrow-parens': 0,
        // allow async-await
        'generator-star-spacing': 0,
        // allow debugger during development
        'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0
    }
}
