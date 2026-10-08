const { withAppDelegate, withInfoPlist } = require('@expo/config-plugins');

/**
 * Expo Config Plugin for iOS 27 UIScene lifecycle adoption.
 * Xcode 27 / iOS 27 SDK requires apps to adopt UIScene life cycle.
 * This plugin ensures that whenever `npx expo prebuild` is executed:
 * 1. Info.plist receives UIApplicationSceneManifest pointing to EXExpoAppSceneDelegate.
 * 2. AppDelegate conforms to ExpoReactNativeFactoryProvider and yields window management to EXExpoAppSceneDelegate.
 */
function withIosSceneLifecycle(config) {
  // 1. Configure Info.plist
  config = withInfoPlist(config, (config) => {
    config.modResults.UIViewControllerBasedStatusBarAppearance = true;
    config.modResults['UISupportedInterfaceOrientations~ipad'] = [
      'UIInterfaceOrientationPortrait',
      'UIInterfaceOrientationPortraitUpsideDown',
      'UIInterfaceOrientationLandscapeLeft',
      'UIInterfaceOrientationLandscapeRight',
    ];
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    };
    return config;
  });

  // 2. Configure AppDelegate.swift
  config = withAppDelegate(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('ExpoReactNativeFactoryProvider')) {
      contents = contents.replace(
        'class AppDelegate: ExpoAppDelegate {',
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {'
      );
    }

    // Remove the legacy manual window creation & React Native start in AppDelegate
    // since EXExpoAppSceneDelegate handles window instantiation and React Native startup.
    const manualWindowRegex = /#if os\(iOS\) \|\| os\(tvOS\)[\s\S]*?factory\.startReactNative[\s\S]*?#endif\n/g;
    contents = contents.replace(manualWindowRegex, '');

    config.modResults.contents = contents;
    return config;
  });

  return config;
}

module.exports = withIosSceneLifecycle;
