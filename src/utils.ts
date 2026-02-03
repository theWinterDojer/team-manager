export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export const nextId = (prefix: string, ids: string[]) => {
  const max = ids.reduce((currentMax, id) => {
    const match = id.match(new RegExp(`^${prefix}_(\\d+)$`))
    if (!match) {
      return currentMax
    }
    return Math.max(currentMax, Number.parseInt(match[1] || '0', 10))
  }, 0)

  return `${prefix}_${max + 1}`
}

export const splitName = (value: string, maxChars = 12) => {
  const trimmed = value.trim()
  if (trimmed.length <= maxChars) {
    return [trimmed]
  }

  const words = trimmed.split(' ')
  if (words.length === 1) {
    return [trimmed.slice(0, maxChars), trimmed.slice(maxChars, maxChars * 2)]
  }

  const middle = Math.floor(words.length / 2)
  const first = words.slice(0, middle).join(' ')
  const second = words.slice(middle).join(' ')
  if (first.length <= maxChars && second.length <= maxChars) {
    return [first, second]
  }

  const splitIndex = trimmed.lastIndexOf(' ', maxChars)
  if (splitIndex > 0) {
    return [trimmed.slice(0, splitIndex), trimmed.slice(splitIndex + 1)]
  }

  return [trimmed.slice(0, maxChars), trimmed.slice(maxChars, maxChars * 2)]
}
