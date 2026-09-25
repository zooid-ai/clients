---
'@zooid/web': patch
---

Read the workforce roster from every `dev.zooid.workforce` state key in the space, not only `""`. Daemons now publish one roster per workstation, so agents from every workstation are recognized as agents.
