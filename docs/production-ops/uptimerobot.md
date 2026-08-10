# Fernly UptimeRobot monitor

## Monitor specification

- Team: `Stark Labs`
- Name: `Fernly Production Health`
- Type: HTTPS keyword monitor
- URL:
  `https://gnrjqqoidzuwzvhhfggh.supabase.co/functions/v1/production-health`
- Interval: 5 minutes, or the shortest interval available to the team plan
- Expected HTTP status: `200`
- Required keyword: `"status":"ok"`
- SSL expiry monitoring: enabled
- Alert contacts: only `nalin.aditya@gmail.com` and
  `starklabs2026@gmail.com`

The endpoint must be invoked without a Supabase JWT. A healthy response exposes
only:

```json
{"appId":"fernly","environment":"production","status":"ok","schemaVersion":1}
```

Database failure returns HTTP 503 with the same fixed shape and
`status=unavailable`. The endpoint never exposes paging flags, provider/Jira
configuration, database identifiers, exception text, or internal timings.

## Proof

Record a redacted monitor-detail view showing the monitor name, public URL,
keyword, interval, and Up state. Record at least one successful check after the
dormant deployment. Do not capture browser cookies, account tokens, or unrelated
monitors.

The verified baseline had zero Stark Labs monitors. Until the monitor exists and
has a successful check, UptimeRobot remains **blocked**, not complete.

## Rollback

If the endpoint is intentionally withdrawn, pause the monitor before redeploying
so a planned rollback does not create a false incident. Do not delete its
history. Restore and prove the endpoint before resuming the monitor.
