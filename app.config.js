

const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = ({ config }) => {
  const buildVariant = process.env.APP_VARIANT;
  const isDevelopmentBuild = buildVariant === 'development';
  const isReleaseBuild = buildVariant
    ? buildVariant === 'preview' || buildVariant === 'production'
    : process.env.NODE_ENV === 'production';
  const apiOrigin = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (isReleaseBuild) {
    let apiUrl;
    try {
      apiUrl = new URL(apiOrigin);
    } catch {
      throw new Error('Preview and production builds require EXPO_PUBLIC_API_URL to be a valid HTTPS origin.');
    }
    if (
      apiUrl.protocol !== 'https:' ||
      apiUrl.username ||
      apiUrl.password ||
      (apiUrl.pathname !== '/' && apiUrl.pathname !== '') ||
      apiUrl.search ||
      apiUrl.hash
    ) {
      throw new Error('Preview and production builds require EXPO_PUBLIC_API_URL to contain only an HTTPS origin.');
    }
  }

  const resolvedConfig = {
    ...config,
    android: {
      ...config.android,
    },
  };

  return withAndroidManifest(resolvedConfig, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0];
    if (!application) {
      throw new Error('Android manifest is missing its application element.');
    }
    application.$['android:usesCleartextTraffic'] = String(isDevelopmentBuild);
    return modConfig;
  });
};
