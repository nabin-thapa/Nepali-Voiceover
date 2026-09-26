<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/0e71743d-d070-443f-a049-d28e4b2d421c

## Run Locally

**Prerequisites:** Node.js 18+ recommended

This project currently has older peer dependencies, so install with the compatibility flag:

1. Install dependencies:
   `npm install --legacy-peer-deps`
2. Create or update `.env.local` and set your Gemini key:
   `GEMINI_API_KEY=your_key_here`
3. Start the app:
   - Windows PowerShell:
     `$env:PORT="3001"; npm run dev`
   - Or if port 3000 is free:
     `npm run dev`

The app is served locally at:
- `http://localhost:3001` when using the PowerShell example above
- otherwise `http://localhost:3000` if that port is available

> If a port is already occupied, set `PORT` to a free port before starting the app.

## Notes

- This project is a Nepali voiceover and TTS research app.
- Some features require valid API credentials and network access.
- The app uses Vite for the frontend and an Express server for the local API layer.
