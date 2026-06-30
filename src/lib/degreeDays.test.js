import { describe, it, expect } from 'vitest'
import { calculateDegreeDays, getAlertLevel } from './degreeDays.js'

describe('calculateDegreeDays', () => {
  it('retourne 0 pour une liste vide', () => {
    expect(calculateDegreeDays([])).toBe(0)
  })

  it('retourne 0 si tous les jours sont sous la base temp', () => {
    const days = [
      { tempMax: 3, tempMin: 0 },
      { tempMax: 4, tempMin: 1 },
    ]
    expect(calculateDegreeDays(days, 5)).toBe(0)
  })

  it('calcule correctement un jour chaud', () => {
    // moyenne = (20 + 10) / 2 = 15 → 15 - 5 = 10 °J
    const days = [{ tempMax: 20, tempMin: 10 }]
    expect(calculateDegreeDays(days, 5)).toBe(10)
  })

  it('accumule plusieurs jours', () => {
    const days = [
      { tempMax: 20, tempMin: 10 }, // moy 15 → +10
      { tempMax: 15, tempMin: 5 },  // moy 10 → +5
      { tempMax: 8,  tempMin: 2 },  // moy 5  → +0 (exactement à la base)
    ]
    expect(calculateDegreeDays(days, 5)).toBe(15)
  })

  it('ne compte pas les jours négatifs (Math.max 0)', () => {
    const days = [
      { tempMax: 2, tempMin: -4 }, // moy -1 → 0
      { tempMax: 20, tempMin: 10 }, // moy 15 → 10
    ]
    expect(calculateDegreeDays(days, 5)).toBe(10)
  })

  it('utilise la base temp 5 par défaut', () => {
    const days = [{ tempMax: 15, tempMin: 5 }] // moy 10 → +5
    expect(calculateDegreeDays(days)).toBe(5)
  })
})

describe('getAlertLevel', () => {
  it('retourne ok en dessous du seuil warning', () => {
    expect(getAlertLevel(10, 40, 60)).toBe('ok')
  })

  it('retourne warning exactement au seuil warning', () => {
    expect(getAlertLevel(40, 40, 60)).toBe('warning')
  })

  it('retourne warning entre les deux seuils', () => {
    expect(getAlertLevel(50, 40, 60)).toBe('warning')
  })

  it('retourne alert exactement au seuil alert', () => {
    expect(getAlertLevel(60, 40, 60)).toBe('alert')
  })

  it('retourne alert au-dessus du seuil alert', () => {
    expect(getAlertLevel(80, 40, 60)).toBe('alert')
  })

  it('retourne ok pour 0', () => {
    expect(getAlertLevel(0, 40, 60)).toBe('ok')
  })
})
