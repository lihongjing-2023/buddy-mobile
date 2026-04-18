const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 生产构建优化：缩小 JS bundle
config.transformer = {
  ...config.transformer,
  // Hermes 已在 app.json 中启用
  minifierPath: 'metro-minify-terser',
  minifierConfig: {
    compress: {
      // 移除 console.log（生产环境）
      drop_console: true,
      dead_code: true,
      unused: true,
      conditionals: true,
      evaluate: true,
      booleans: true,
      loops: true,
      side_effects: true,
    },
    mangle: true,
    output: {
      ascii_only: true,
      comments: false,
    },
  },
};

module.exports = config;