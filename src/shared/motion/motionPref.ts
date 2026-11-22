/**
 * Per-device motion override. The OS "reduce motion" setting still wins by default, but some
 * systems (Windows with "Animation effects" off) turn it on without the user knowing, which makes
 * the whole app look static. "Always play" lets the user opt back in; it sets `data-motion="on"`
 * on <html>, which the CSS reduced-motion rules and `prefersReducedMotion()` both respect.
 */
const KEY = 'hzzt.motion'
export type MotionPref = 'system' | 'on'

export function readMotionPref(): MotionPref {
  try {
    return localStorage.getItem(KEY) === 'on' ? 'on' : 'system'
  } catch {
    return 'system'
  }
}

export function applyMotionPref(pref: MotionPref = readMotionPref()) {
  if (typeof document === 'undefined') return
  if (pref === 'on') document.documentElement.setAttribute('data-motion', 'on')
  else document.documentElement.removeAttribute('data-motion')
}

export function writeMotionPref(pref: MotionPref) {
  try {
    if (pref === 'on') localStorage.setItem(KEY, 'on')
    else localStorage.removeItem(KEY)
  } catch {
    // Storage blocked: the choice lasts for this page view only.
  }
  applyMotionPref(pref)
}

/** True when the OS asks for reduced motion, regardless of the override. */
export function systemReducesMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
