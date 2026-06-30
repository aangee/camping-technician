import { describe, it, expect } from 'vitest'

// Logique extraite de PiscineModule — cumul pluie sur N jours
function cumulPluie(weatherDays, nJours) {
  return weatherDays.slice(-nJours).reduce((acc, d) => acc + (d.precipitation ?? 0), 0)
}

function progressPct(totalRain, thresholdAlert) {
  return Math.min(100, (totalRain / thresholdAlert) * 100)
}

describe('cumulPluie', () => {
  const weather = [
    { date: '2026-05-09', precipitation: 2 },
    { date: '2026-05-10', precipitation: 0 },
    { date: '2026-05-11', precipitation: 10 },
    { date: '2026-05-12', precipitation: 5 },
    { date: '2026-05-13', precipitation: 0 },
    { date: '2026-05-14', precipitation: 8 },
    { date: '2026-05-15', precipitation: 3 },
  ]

  it('cumule les 7 derniers jours', () => {
    // 2+0+10+5+0+8+3 = 28
    expect(cumulPluie(weather, 7)).toBe(28)
  })

  it('cumule seulement les N derniers jours', () => {
    // 3 derniers : 0+8+3 = 11
    expect(cumulPluie(weather, 3)).toBe(11)
  })

  it('retourne 0 si pas de pluie', () => {
    const sec = [{ precipitation: 0 }, { precipitation: 0 }]
    expect(cumulPluie(sec, 7)).toBe(0)
  })

  it('gère les valeurs null', () => {
    const avecNull = [{ precipitation: null }, { precipitation: 5 }]
    expect(cumulPluie(avecNull, 7)).toBe(5)
  })
})

describe('progressPct piscine', () => {
  it('est 0 si pas de pluie', () => {
    expect(progressPct(0, 30)).toBe(0)
  })

  it('est 50% à mi-chemin', () => {
    expect(progressPct(15, 30)).toBeCloseTo(50)
  })

  it('est plafonné à 100% au-dessus du seuil', () => {
    expect(progressPct(50, 30)).toBe(100)
  })

  it('est exactement 100% au seuil alert', () => {
    expect(progressPct(30, 30)).toBe(100)
  })
})
