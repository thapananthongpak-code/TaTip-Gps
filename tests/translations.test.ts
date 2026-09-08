import { expect, it } from 'vitest'
import th from '../src/i18n/locales/th.json'
import en from '../src/i18n/locales/en.json'
function flatten(value: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) =>
      typeof entry === 'string'
        ? [[prefix + key, entry]]
        : Object.entries(flatten(entry as Record<string, unknown>, prefix + key + '.')),
    ),
  )
}
it('Thai and English cover the same messages and interpolation parameters', () => {
  const thai = flatten(th),
    english = flatten(en)
  // Thai has only the CLDR "other" plural category; English also needs "one".
  expect(Object.keys(thai).sort()).toEqual(
    Object.keys(english)
      .filter((key) => !key.endsWith('_one'))
      .sort(),
  )
  for (const key of Object.keys(english).filter((key) => key.endsWith('_one'))) {
    expect(thai[key.replace(/_one$/, '_other')], key).toBeTruthy()
  }
  for (const key of Object.keys(thai)) {
    expect(thai[key].trim(), key).not.toBe('')
    expect((thai[key].match(/\{\{[^}]+\}\}/g) ?? []).sort(), key).toEqual(
      (english[key].match(/\{\{[^}]+\}\}/g) ?? []).sort(),
    )
  }
})
