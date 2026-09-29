<p align="center"><img src="public/img/logo.svg" width="72" alt="ClassPulse logo"></p>

# ClassPulse — Real-time Interactive Classroom

A minimal LMS-style web app where teachers ask questions and every student answers live from their phone.
Inspired by **Socrative** (Quick Question, Exit Ticket, quizzes, reports) and **Slido** (poll types, word cloud, upvoted Q&A with moderation, timers, leaderboard).
Solves 50 problem statements from the "Interactive Classroom" brief: see [PROBLEMS.md](PROBLEMS.md).

## Features
- 6 question types: Multiple choice, True/False, Poll, Rating, Word cloud, Open text
- Timers, auto-grading, points with speed bonus, leaderboard
- Exit Ticket preset and a question queue (teacher-paced quiz)
- Anonymous "I'm confused" button, pace feedback (too fast / too slow), emoji reactions
- Anonymous Q&A with upvotes, moderation, mark answered, delete
- Students tab (who answered / confused / waiting), CSV report
- White LMS-green theme with a dark/light toggle (text colors adapt), mobile-first student UI

## Project structure
```
classpulse/
├── server.js          # Node HTTP + Server-Sent Events (no dependencies)
├── package.json
├── render.yaml        # one-click deploy blueprint for Render
├── PROBLEMS.md        # 50 problem statements mapped to features
└── public/
    ├── index.html  teacher.html  student.html
    ├── css/style.css
    ├── js/theme.js  teacher.js  student.js
    └── img/logo.svg   # logo and favicon
```

## Run locally
Requires Node.js 16+ (no `npm install` needed).
```
node server.js
```
- Teacher: http://localhost:3000/teacher → Start session (4-digit code)
- Students (same WiFi): open the "Students" URL printed in the terminal, enter the code

## Demo script (3 minutes)
1. Teacher starts a session, 2–3 phones join with nicknames.
2. Send an MCQ with a timer → bars move live → Close & reveal → leaderboard.
3. Send a Word cloud → students type words → cloud grows.
4. A student taps "I'm confused" and "Too fast" → dashboard stats change; open the Students tab.
5. A student asks a question in Q&A → teacher approves → others upvote.
6. Start Exit Ticket → Report tab → Download CSV. Toggle dark theme.

## Open in Antigravity → push to GitHub → get a public link
1. Open this folder in Antigravity, then in its terminal run `node server.js` to check it works.
2. Create an empty repo on github.com, then in the terminal:
```
git init
git add .
git commit -m "ClassPulse"
git branch -M main
git remote add origin https://github.com/<your-username>/classpulse.git
git push -u origin main
```
3. **GitHub only stores the code.** GitHub Pages cannot run this app because it needs a Node server. To get a live link, deploy the repo on Render (free):
   - render.com → New → Web Service → connect your GitHub repo
   - Runtime: Node, Build command: `npm install`, Start command: `node server.js`, Plan: Free
   - After deploy you get `https://classpulse-xxxx.onrender.com`. Teacher: `/teacher`, students: `/student`.
4. The free plan sleeps after inactivity: open the link once about a minute before the demo.
5. Quick alternative without deploying: `npx localtunnel --port 3000` gives a temporary public link to your running laptop.

## Notes
- Sessions live in server memory; restarting the server ends all sessions (fine for class use).
- Only one server instance should run per deployment.
