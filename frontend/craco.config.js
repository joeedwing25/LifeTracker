// craco.config.js
const path = require("path");

// Safe environment config loading
try {
  require("dotenv").config();
} catch (e) {
  console.warn("dotenv not available");
}

const isDevServer = process.env.NODE_ENV !== "production";
const isProduction = process.env.NODE_ENV === "production";

// Log build environment
if (isProduction) {
  console.log("[Build Info] Production build detected - using optimized configuration");
}

// Environment variable overrides
const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true" && !isProduction,
};

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  try {
    WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
    setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
    healthPluginInstance = new WebpackHealthPlugin();
    console.log("[Health Check] Health check plugins loaded successfully");
  } catch (err) {
    console.warn("[Build Warning] Health check plugins not available:", err.message);
    config.enableHealthCheck = false;
  }
}

let webpackConfig = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {
      // Add ignored patterns to reduce watched directories
      webpackConfig.watchOptions = {
        ...webpackConfig.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/build/**',
          '**/dist/**',
          '**/coverage/**',
          '**/public/**',
        ],
      };

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        try {
          webpackConfig.plugins.push(healthPluginInstance);
        } catch (err) {
          console.warn("[Build Warning] Could not add health check plugin:", err.message);
        }
      }
      return webpackConfig;
    },
  },
};

webpackConfig.devServer = (devServerConfig) => {
  // Add health check endpoints if enabled
  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      // Call original setup if exists
      if (originalSetupMiddlewares) {
        middlewares = originalSetupMiddlewares(middlewares, devServer);
      }

      // Setup health endpoints
      try {
        setupHealthEndpoints(devServer, healthPluginInstance);
      } catch (err) {
        console.warn("[Dev Server Warning] Could not setup health endpoints:", err.message);
      }

      return middlewares;
    };
  }

  return devServerConfig;
};

module.exports = webpackConfig;
