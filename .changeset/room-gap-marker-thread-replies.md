---
"@zooid/web": patch
---

The "Load messages" marker for a hole in a room's history now shows up when everything after the hole is thread replies, which is the usual case in agent rooms. Before, the marker was silently dropped there: missing threads (a morning standup, say) just weren't shown, and nothing indicated anything was missing.
