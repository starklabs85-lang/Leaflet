# Fernly production-ops evidence index

All evidence is redacted. No file may contain credential values, token-bearing
URLs, browser cookies, user data, plant content, raw request bodies, exception
text, stack traces, IP addresses, or unrelated account state.

## Baseline

- [Baseline verification](baseline.md): complete.
- Accountable owner: Arnab.
- Jira Epic: `FERN-2`.
- Starting source: `fernly_following_guidelines` at
  `afae9d5cf6eeb51eb8db47fd6bdc4c8edddd8373`.

## Required deployment and activation evidence

- [Dormant deployment](dormant-deployment.md): complete.
  - reviewed branch/commit and linked migration provenance;
  - dormant flags `enabled=false`, `kill_switch=true`;
  - deployed function versions;
  - public health and unauthorized ingress.
- [Provider and Jira](provider-and-jira.md): complete.
  - one controlled provider message in each approved inbox;
  - exact provider replay remains one per inbox;
  - Jira Automation create/update audit and one exact-label Bug;
  - wrong-app and wrong-token rejection.
- [Canary and kill switch](canary-and-kill-switch.md): complete.
  - one live canary email per inbox and one Jira Bug;
  - exact replay counts remain one;
  - kill-switch drill creates no provider/Jira/audit activity;
  - restored final flags.
- [Monitoring and crash coverage](monitoring-and-crash.md): complete.
  - UptimeRobot monitor and successful check;
  - Firebase Crashlytics known-gap proof.

All activation evidence is present. Fernly paging is live with final flags
`enabled=true`, `kill_switch=false`. HTTP 2xx was not treated as inbox proof,
and Jira issue existence was not treated as Automation audit proof.
