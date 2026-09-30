# Submission Checklist

Here is the information needed to manually submit to the Clickup form:

- **GitHub Repository URL:** [To be created and pushed by user]
- **Demo Video URL:** [To be recorded by user using DEMO.md script]
- **Figma Implementation Confirmation:** Yes, strictly matched colors, typography, empty states, and modal designs.
- **Technologies Used:** React, Vite, TailwindCSS, Express.js, PostgreSQL, Prisma, Redis, BullMQ, Ethereal SMTP, Elasticsearch, Slack OAuth, Google OAuth.
- **Assumptions:** 
  - Standard Ethereal accounts have low rate limits, so we handle SMTP failures gracefully without crashing.
  - Using Fixed-window rate limiting via Redis INCR/EXPIRE is sufficient for this scope.
- **Limitations:** 
  - Exactly-once delivery is a hard distributed systems problem with SMTP; the system minimizes duplicate sends but cannot eliminate the network partition window.
- **Bull Board URL:** `http://localhost:5000/admin/queues`
- **Local Setup Instructions:** Read `README.md`.
