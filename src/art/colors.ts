/**
 * 材质固有色：不随地图卡变化的颜色（皮肤、木头、石头、金属...）。
 * 场景主体颜色仍然要用调色板；这里只放“现实中就是这个颜色”的东西。
 * 🎨 Cursor 工作区，可自由增补。
 */
export const COLORS = {
  skin: ['#ffe0c8', '#f1c27d', '#c68642', '#8d5524'],
  wood: '#8a5a3c',
  woodLight: '#c4a574',
  woodDark: '#5c3a28',
  bark: '#6b4a3a',
  stone: '#a9a39a',
  stoneDark: '#77716a',
  stoneLight: '#d4cfc6',
  metal: '#6e7480',
  metalDark: '#4a5058',
  glass: '#bfe3f2',
  black: '#2a2430',
  white: '#f8f4ec',
} as const;
