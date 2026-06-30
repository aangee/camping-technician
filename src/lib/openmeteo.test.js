import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchWeather } from './openmeteo.js'

const mockApiResponse = {
  daily: {
    time:                  ['2026-05-10', '2026-05-11', '2026-05-12'],
    temperature_2m_max:    [22, 18, null],
    temperature_2m_min:    [10, 8,  null],
    precipitation_sum:     [0,  5.2, null],
  },
}

beforeEach(() => {
  global.fetch = vi.fn()
})

describe('fetchWeather', () => {
  it('retourne les données formatées correctement', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    })

    const result = await fetchWeather({ lat: 45.34, lon: 4.65, days: 14 })

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ date: '2026-05-10', tempMax: 22, tempMin: 10, precipitation: 0 })
    expect(result[1]).toEqual({ date: '2026-05-11', tempMax: 18, tempMin: 8,  precipitation: 5.2 })
  })

  it('remplace null par 0', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    })

    const result = await fetchWeather({ lat: 45.34, lon: 4.65 })
    expect(result[2].tempMax).toBe(0)
    expect(result[2].tempMin).toBe(0)
    expect(result[2].precipitation).toBe(0)
  })

  it('lève une erreur si la réponse API est en erreur', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 500 })

    await expect(fetchWeather({ lat: 45.34, lon: 4.65 })).rejects.toThrow('Open-Meteo API error: 500')
  })

  it('inclut les bons paramètres dans l\'URL', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ daily: { time: [], temperature_2m_max: [], temperature_2m_min: [], precipitation_sum: [] } }),
    })

    await fetchWeather({ lat: 45.34, lon: 4.65, days: 30 })

    const calledUrl = global.fetch.mock.calls[0][0]
    expect(calledUrl).toContain('latitude=45.34')
    expect(calledUrl).toContain('longitude=4.65')
    expect(calledUrl).toContain('past_days=30')
    expect(calledUrl).toContain('timezone=Europe%2FParis')
  })
})
