import { useEffect, useState } from "react";

/**
 * Whether a list's search is still running: from the first keystroke, through
 * the debounce, until the new search's results arrive. A refresh for any other
 * reason (another page, filter or sort) doesn't count.
 *
 * `typed` is what is in the search box, `search` the debounced search the list
 * is queried with, and `refreshing` whether the list still shows older results.
 */
export function useSearching(typed: string, search: string, refreshing: boolean) {
  // The search the results on screen were loaded for.
  const [shownSearch, setShownSearch] = useState(search);
  useEffect(() => {
    if (!refreshing) setShownSearch(search);
  }, [refreshing, search]);

  return typed !== search || (refreshing && search !== shownSearch);
}
