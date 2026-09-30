# Demo Script (Max 5 minutes)

## 0:00 - 0:30: Project & Architecture
- Open the codebase.
- Briefly show `docker-compose.yml` (PostgreSQL, Redis, Elasticsearch).
- Show the `worker/index.ts` file highlighting the `checkRateLimit` and `getDelayForNextHour` logic.

## 0:30 - 1:00: Google Login
- Start the frontend and backend.
- Go to `localhost:5173`.
- Show the beautiful Figma-matched login screen.
- Click "Login with Google". Show the OAuth consent screen and redirect back to the Dashboard.

## 1:00 - 2:00: Compose Campaign
- In the Dashboard, click **Compose**.
- Upload a `test-emails.csv` file. Show the UI stripping duplicates and invalid emails.
- Fill in:
  - Delay: `2000` (2 seconds)
  - Hourly Limit: `3` (intentionally low to trigger Slack)
- Hit **Send Later**.

## 2:00 - 2:45: Scheduled Emails & Bull Board
- Show the Dashboard's **Scheduled** tab. The emails appear here with an orange "Scheduled" badge.
- Open `http://localhost:5000/admin/queues` (Bull Board).
- Show the jobs sitting in the `delayed` state.

## 3:00 - 3:45: Emails Sending
- Watch the BullMQ jobs transition to `active` then `completed`.
- Switch back to the Dashboard and click **Sent**.
- Show the emails now marked as "Sent". 
- (Optional) Show the Ethereal preview link logged in the backend console.

## 3:45 - 4:30: Restart Scenario
- Schedule another batch for 5 minutes in the future.
- Stop the `npm run worker` process.
- Restart the worker process.
- Show in Bull Board that the jobs persisted perfectly through the restart and resume execution.

## 4:30 - 5:00: Rate Limiting & Slack
- Show that because we sent 3 emails, the 4th and 5th emails were automatically pushed to the next hour (delayed by 3600s).
- Open the Slack workspace.
- Show the real-time Slack notification from our OAuth bot: *"⚠️ Email rate limit reached. Sender: demo. Limit: 3/hour..."*
