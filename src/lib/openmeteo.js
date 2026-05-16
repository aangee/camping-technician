const BASE_URL = 'https://api.open-meteo.com/v1/forecast'

export async function fetchWeather({ lat, lon, days = 14 }) {
  const url = new URL(BASE_URL)
  url.searchParams.set('latitude', lat)
  url.searchParams.set('longitude', lon)
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum')
  url.searchParams.set('past_days', days)
  url.searchParams.set('forecast_days', '1')
  url.searchParams.set('timezone', 'Europe/Paris')

  const resp = await fetch(url.toString())
  if (!resp.ok) throw new Error(`Open-Meteo API error: ${resp.status}`)
  const data = await resp.json()

  return data.daily.time.map((date, i) => ({
    date,
    tempMax: data.daily.temperature_2m_max[i] ?? 0,
    tempMin: data.daily.temperature_2m_min[i] ?? 0,
    precipitation: data.daily.precipitation_sum[i] ?? 0,
  }))
}
