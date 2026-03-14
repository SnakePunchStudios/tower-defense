/**
 * Community Maps Index
 *
 * To add a new map to the game:
 * 1. Export your map from the Map Editor (click "DL" button)
 * 2. Drop the .json file into this folder (src/data/maps/)
 * 3. Import it below and add it to the array
 * 4. Push to git — the map will appear for everyone!
 */
import type { MapData } from '../../types';
import grasslands from './grasslands.json';

// Add new community maps here:
const builtInMaps: MapData[] = [
  grasslands as unknown as MapData,
  // Example: import myMap from './my-cool-map.json';
  // then add: myMap as unknown as MapData,
];

export default builtInMaps;
