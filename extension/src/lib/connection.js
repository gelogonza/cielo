/**
 * Does a Cielo actually answer at this address?
 *
 * A typo'd host used to be invisible until the next save failed, which is a
 * bad place to find out. `/api/sections` is the cheapest honest probe: it is
 * behind `withAuth`, so a 401 is just as much proof that Cielo is there as a
 * 200 — and it tells the two apart, which is worth saying, because "not logged
 * in" and "wrong address" look identical from the toolbar otherwise.
 *
 * No new permission: `<all_urls>` already covers whatever the user types.
 */
/**
 * @param {string} baseUrl
 * @param {(url: string, init?: object) => Promise<{ status: number }>} [fetchImpl]
 *   Injectable so the probe can be tested without a network.
 */
export async function probeApi(baseUrl, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(`${baseUrl}/api/sections`, { credentials: "include" });
    return { reached: true, status: response.status };
  } catch {
    return { reached: false, status: 0 };
  }
}

/** Pure, so the wording is testable without a network. */
export function describeConnection(probe) {
  if (!probe.reached) {
    return { tone: "error", message: "Nothing answered at that address." };
  }

  if (probe.status === 200) {
    return { tone: "ok", message: "Connected, and you are signed in." };
  }

  if (probe.status === 401) {
    return { tone: "ok", message: "Found Cielo. Log in there to start saving." };
  }

  return {
    tone: "error",
    message: `Something answered (${probe.status}), but it is not a Cielo.`,
  };
}
