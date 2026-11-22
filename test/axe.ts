import axe from 'axe-core'

/**
 * Runs axe-core on a DOM node. jsdom has no layout, so rules that need rendered geometry
 * (colour contrast, which the token audit covers separately) are switched off.
 */
export async function axeViolations(root: Element = document.body): Promise<string[]> {
  const results = await axe.run(root, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  })
  return results.violations.map(
    (v) =>
      `${v.id}: ${v.help} (${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 3)
        .join(' | ')})`,
  )
}
