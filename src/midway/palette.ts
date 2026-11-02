import { theme } from '../carnival';

const { colors } = theme;

/**
 * The midway map's warcamp palette. Banner reds, bones and brasses come from
 * the carnival theme; the dusk sky, mud, paths and other scenery shades only
 * the map uses live here.
 */
export const palette = {
  sky: '#4b4a52',
  skyHigh: '#2e2c36',
  cloud: '#77736f',
  cloudShade: '#5c5855',
  haze: '#5b6347',

  grass: '#4f5a2c',
  grassDark: '#414a23',
  grassEdge: '#353d1c',
  grassLight: '#5f6a35',
  path: '#7a6446',
  pathShade: '#665238',
  hedge: '#2f3a1e',
  hedgeDark: '#222b15',
  hedgeLight: '#3e4a27',
  shadow: 'rgba(15, 20, 8, 0.35)',

  red: colors.stripeA,
  redShade: '#6a2214',
  cream: colors.stripeB,
  creamShade: '#a89b7b',
  gold: colors.accent,
  goldShade: '#8a6528',
  blue: '#5b6b5e',
  blueShade: '#434f45',
  sky2: colors.water,
  pink: '#8c5a4a',
  pinkShade: '#6e4538',
  wood: colors.wood,
  woodDark: '#32241a',
  woodLight: '#6e5236',
  board: '#7d6544',
  metal: '#8a7f72',
  metalShade: '#6b5240',
  ink: colors.background,
  opening: '#1c140f',
  closed: '#5a5850',
  closedShade: '#45443d',
  white: '#ffffff',

  skins: ['#6b8e23', '#7a9a3a', '#556b2f', '#8fae4a', '#5f7f2c'],
  hairs: ['#1e1a14', '#141a0f', '#3b2a1c', '#4a4a3a', '#32241a'],
  shirts: [colors.stripeA, '#5c4a32', '#4a4f3a', colors.danger, '#6b5240', colors.stripeB],
  pants: ['#2a2419', '#3a3226', '#2f3324'],
  bunting: [colors.stripeA, colors.accent, '#5c4a32', colors.stripeB],
  balloons: [colors.stripeA, colors.accent, '#5c4a32', colors.water, '#8c5a4a'],
} as const;
