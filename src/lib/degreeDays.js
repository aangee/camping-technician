export function calculateDegreeDays(weatherDays, baseTemp = 5) {
  return weatherDays.reduce((acc, day) => {
    const mean = (day.tempMax + day.tempMin) / 2
    return acc + Math.max(0, mean - baseTemp)
  }, 0)
}

export function getAlertLevel(value, warningThreshold, alertThreshold) {
  if (value >= alertThreshold) return 'alert'
  if (value >= warningThreshold) return 'warning'
  return 'ok'
}
