import {expect,test} from 'bun:test'
import {formatWeddingDate} from './wedding-template-defaults'
test('default wedding date is stable across server/browser ICU punctuation and time zones',()=>{
 expect(formatWeddingDate('2027-06-12T00:00:00.000Z')).toBe('Saturday 12 June 2027')
 expect(formatWeddingDate('2026-12-23T23:00:00.000Z')).toBe('Wednesday 23 December 2026')
 expect(formatWeddingDate('invalid')).toBe('')
})
