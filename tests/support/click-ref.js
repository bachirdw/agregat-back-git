// Test-only bridge from a fixture CSS selector to the ref emitted by a snapshot.
// Every browser.click call made through this helper receives only { ref }.
export async function refFor(gateway, selector) {
  const provider = gateway.provider;
  if (provider.pages) {
    const elements = provider.pages[provider.url]?.elements ?? {};
    const item = elements[selector];
    if (!item) throw new Error(`FICTIF : élément absent ${selector}`);
    let ref = Object.keys(elements).find(
      (key) => /^(?:f\d+)?e\d+$/.test(key) && elements[key] === item,
    );
    if (!ref) {
      let index = 1;
      while (elements[`e${index}`]) index++;
      ref = `e${index}`;
      elements[ref] = item;
    }
    return ref;
  }
  const snapshot = (await provider.perform('browser.snapshot', {}, gateway.policy)).snapshot;
  for (const [, ref] of snapshot.matchAll(/\[ref=((?:f\d+)?e\d+)\]/g)) {
    const match = await provider.page
      .getByRef(ref)
      .evaluate((el, css) => el.matches(css), selector)
      .catch(() => false);
    if (match) return ref;
  }
  throw new Error(`FICTIF : référence absente pour ${selector}`);
}
export async function clickRef(gateway, selector) {
  return gateway.call('browser.click', { ref: await refFor(gateway, selector) });
}
