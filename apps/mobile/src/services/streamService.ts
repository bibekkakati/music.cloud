import AsyncStorage from '@react-native-async-storage/async-storage';
import { streamService } from '@music-cloud/services';
import { appConfig } from '../config';

// Configure shared streamService with mobile's AsyncStorage
streamService.setStorageAdapter(
  {
    getItem: (key) => AsyncStorage.getItem(key),
    setItem: (key, val) => AsyncStorage.setItem(key, val),
    removeItem: (key) => AsyncStorage.removeItem(key),
  },
  appConfig.storageKeys.streamToken
);

export { streamService, streamService as default };
