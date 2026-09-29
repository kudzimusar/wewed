import { describe, expect, test } from 'bun:test'
import {
  plannerModuleFromPath,
  plannerModulePath,
  plannerToolFromPath,
} from './planner-route-state'

describe('Planner invitation operations route', () => {
  test('gives Guest invitations their own durable route', () => {
    expect(plannerModuleFromPath('/planner/guests/invitations')).toBe('guests')
    expect(plannerToolFromPath('/planner/guests/invitations', 'guests')).toBe('invitations')
    expect(plannerModulePath('guests', 'invitations')).toBe('/planner/guests/invitations')
  })

  test('does not expose invitations as a tool under unrelated Planner modules', () => {
    expect(plannerToolFromPath('/planner/overview/invitations', 'overview')).toBeNull()
  })
})
