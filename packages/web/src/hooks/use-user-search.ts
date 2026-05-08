import { useEffect, useState } from "react";
import { MatrixClientPeg } from "../client/peg";
import { useDebounce } from "./use-debounce";

export interface UserSearchResult {
  userId: string;
  displayName?: string;
  avatarUrl?: string;
}

interface State {
  results: UserSearchResult[];
  loading: boolean;
}

const EMPTY: State = { results: [], loading: false };

export function useUserSearch(query: string): State {
  const debounced = useDebounce(query.trim(), 300);
  const [state, setState] = useState<State>(EMPTY);

  useEffect(() => {
    const client = MatrixClientPeg.safeGet();
    if (!client || !debounced) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    void (
      client as unknown as {
        searchUserDirectory: (opts: { term: string; limit: number }) => Promise<{
          results: Array<{ user_id: string; display_name?: string; avatar_url?: string }>;
        }>;
      }
    )
      .searchUserDirectory({ term: debounced, limit: 10 })
      .then((res) => {
        if (cancelled) return;
        const me = client.getUserId();
        const results: UserSearchResult[] = res.results
          .filter((r) => r.user_id !== me)
          .map((r) => ({
            userId: r.user_id,
            displayName: r.display_name,
            avatarUrl: r.avatar_url,
          }));
        setState({ results, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ results: [], loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  return state;
}
