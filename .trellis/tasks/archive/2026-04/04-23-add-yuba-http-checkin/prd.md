# Add Yuba HTTP Check-In Task

## Goal
Add a Docker WebUI managed Yuba check-in task that signs into followed Yuba groups through stable HTTP requests instead of browser automation.

## Requirements
- Add a new scheduled task named `yubaCheckIn` to the Docker runtime.
- Use HTTP requests only; do not use Puppeteer or browser tab automation for Yuba check-in.
- Reuse the existing Douyu cookie config and derive required request headers from it.
- Fetch followed Yuba groups through the current HTTP API instead of scraping the `mygroups` page.
- Skip groups that are already signed in for the current day when the API exposes that status.
- Surface task status, manual trigger, config save, and logs in the Docker WebUI.

## Acceptance Criteria
- [ ] Docker config can persist `yubaCheckIn` task settings.
- [ ] Manual trigger runs Yuba check-in through HTTP requests only.
- [ ] Scheduled execution starts when the task is enabled and cookie is present.
- [ ] WebUI shows a dedicated Yuba check-in page with enable switch, cron input, and trigger action.
- [ ] Logs clearly show list fetch, per-group sign result, and login/CSRF failures without exposing secrets.

## Technical Notes
- Use `/wgapi/yubanc/api/user/getUserFollowGroupList` to page through followed Yuba groups.
- Use `/wbapi/web/group/head` to load per-group sign state and current exp.
- Use `/ybapi/topic/sign` with form data and dynamic `X-CSRF-TOKEN` from the `acf_yb_t` cookie.
- Treat Gee or auth failures as explicit runtime failures and stop the current run with actionable logs.
