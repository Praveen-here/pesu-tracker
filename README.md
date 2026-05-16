# PESU Tracker

A clean, minimalist, and highly accurate Academic Dashboard for PES University students. Built with Next.js and Node.js, this platform securely fetches attendance and marks from PESU Academy and provides actionable insights for students to maintain their attendance requirements and CGPA targets.

## Features

- **Attendance Tracker**: View real-time subject-wise attendance, "safe bunk" allowance, and precise recovery targets if you're falling behind.
- **CGPA Tracker**: Tracks your ISA and ESA marks without making assumptions. Calculates the exact marks needed in upcoming assessments to maintain a CGPA ≥ 8.0 (for placement readiness).
- **Rank & Percentile Insight** *(Current Semester)*: Shows where you stand academically compared to your classmates — based on the university's own published ISA mark distributions. Displays an animated overall standing card (e.g. "Top 15%") with a per-subject breakdown, so you know exactly which subjects you're excelling in and which need attention. Data is sourced directly from PESU Academy's result graphs and requires no manual input.
- **Honest Analytics**: Unlike other trackers, PESU Tracker does not assume arbitrary ESA grades. It provides exact ranges based on your current ISA scores.
- **Minimalist UI**: A sleek, monochrome dark mode interface optimized for speed and readability.
- **Secure**: Credentials are used strictly for real-time fetching via PESU Academy and are never permanently stored. Sessions are securely managed via Redis.

## Tech Stack

- **Frontend**: Next.js (App Router), React, Tailwind CSS, Framer Motion, Lucide Icons
- **Backend**: Node.js, Express, Axios, Cheerio (for web scraping)
- **Database/Cache**: Upstash Redis (for secure session storage)

## Local Development

### Prerequisites
- Node.js (v18+)
- A free [Upstash Redis](https://upstash.com/) Database URL

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/pesu-tracker.git
   cd pesu-tracker
   ```

2. Install dependencies for both frontend and backend:
   ```bash
   npm install
   cd frontend && npm install
   cd ../backend && npm install
   ```

3. Set up Environment Variables:
   Create a `.env` file in the `backend/` directory:
   ```env
   PORT=5000
   SESSION_SECRET=your_super_secret_session_key
   REDIS_URL=your_upstash_redis_url
   FRONTEND_URL=http://localhost:3000
   ```

4. Run the development server from the root directory:
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:3000` and the backend at `http://localhost:5000`.

## Deployment

This application is split into two parts:
- **Frontend** is optimized for deployment on [Vercel](https://vercel.com/). Ensure you set the `NEXT_PUBLIC_BACKEND_URL` environment variable.
- **Backend** is designed to be hosted on platforms like [Render](https://render.com/) or Railway. Ensure you set the `FRONTEND_URL` and `REDIS_URL` environment variables.

## Disclaimer
Not affiliated with or endorsed by PES University. This is an independent student project built to improve the academic tracking experience.
