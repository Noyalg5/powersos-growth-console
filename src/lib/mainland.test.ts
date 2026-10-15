import { describe, expect, it } from 'vitest'
import { isOnMainland, MAINLAND_OUTLINE } from './mainland'

const at = (lat: number, lng: number) => ({ lat, lng })

describe('isOnMainland', () => {
  it.each([
    ['Thurso', 58.593, -3.522],
    ['Durness', 58.567, -4.746],
    ['Ullapool', 57.896, -5.158],
    ['Kyle of Lochalsh', 57.28, -5.714],
    ['Oban', 56.415, -5.472],
    ['Campbeltown', 55.425, -5.605],
    ['Stranraer', 54.903, -5.024],
    ['Fraserburgh', 57.693, -2.005],
    ['Berwick-upon-Tweed', 55.771, -2.007],
    ['Scarborough', 54.283, -0.4],
    ['Lowestoft', 52.475, 1.75],
    ['Margate', 51.389, 1.386],
    ['Dover', 51.129, 1.31],
    ['Brighton', 50.822, -0.137],
    ['Weymouth', 50.614, -2.457],
    ['Penzance', 50.118, -5.537],
    ['Bude', 50.829, -4.543],
    ["St David's", 51.881, -5.266],
    ['Pwllheli', 52.888, -4.417],
    ['Llandudno', 53.324, -3.827],
    ['Blackpool', 53.817, -3.05],
    ['Whitehaven', 54.549, -3.587],
  ])('puts %s on the mainland', (_name, lat, lng) => {
    expect(isOnMainland(at(lat, lng))).toBe(true)
  })

  it.each([
    ['Belfast', 54.597, -5.93],
    ['Dublin', 53.35, -6.26],
    ['Douglas, Isle of Man', 54.15, -4.48],
    ['Lerwick, Shetland', 60.155, -1.145],
    ['Kirkwall, Orkney', 58.98, -2.96],
    ['Stornoway, Lewis', 58.21, -6.39],
    ['Portree, Skye', 57.41, -6.19],
    ['Tobermory, Mull', 56.62, -6.07],
    ['Bowmore, Islay', 55.76, -6.29],
    ['Hugh Town, Scilly', 49.91, -6.31],
    ['St Helier, Jersey', 49.19, -2.11],
    ['Calais', 50.95, 1.86],
    ['the North Sea', 54.5, 1.5],
    ['the Irish Sea', 53.8, -4.5],
    ['the Channel', 50.2, -1.5],
    ['null island', 0, 0],
    ['Leeds with latitude and longitude swapped', -1.55, 53.8],
  ])('puts %s off the mainland', (_name, lat, lng) => {
    expect(isOnMainland(at(lat, lng))).toBe(false)
  })

  it('rejects coordinates that are not numbers', () => {
    expect(isOnMainland(at(Number.NaN, -1.5))).toBe(false)
    expect(isOnMainland(at(53.8, Infinity))).toBe(false)
  })

  it('is a closed outline of plausible coordinates', () => {
    expect(MAINLAND_OUTLINE.length).toBeGreaterThan(50)
    for (const [lat, lng] of MAINLAND_OUTLINE) {
      expect(lat).toBeGreaterThan(49.8)
      expect(lat).toBeLessThan(58.8)
      expect(lng).toBeGreaterThan(-6.5)
      expect(lng).toBeLessThan(2)
    }
  })
})
