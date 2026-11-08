import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// The shared `supabase` / `supabaseAdmin` singletons are reused by every
// request. Any call that CREATES a session stores it in that instance's memory,
// leaking one user's session into other requests. Such calls must go through
// createRequestAuthClient() instead.
const SESSION_CREATING = /\bsupabase(Admin)?\.auth\.(signInWithPassword|signInWithOtp|signInWithOAuth|signInWithIdToken|signInAnonymously|signUp|refreshSession|setSession|verifyOtp|exchangeCodeForSession)\(/

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return walk(p)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [p] : []
  })
}

describe('shared Supabase client never holds a user session', () => {
  it('no session-creating auth call is made on a shared singleton', () => {
    const offenders = walk(join(__dirname, '..', '..'))
      .flatMap((f) => readFileSync(f, 'utf8').split(/\r?\n/).map((line, i) => ({ f, i: i + 1, line })))
      .filter(({ line }) => SESSION_CREATING.test(line))
      .map(({ f, i, line }) => `${f}:${i}  ${line.trim()}`)
    expect(offenders).toEqual([])
  })
})
