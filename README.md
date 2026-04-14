<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/384dc093-ffc3-4ab0-8f5d-223ac8c5e21c

## Environment Variables

We use environment variables to configure the application's contract addresses and RPC URLs, with a distinction between Development and Production targets.

When running the application locally via `npm run dev` (Development mode), Vite is configured to use variables prefixed with `TEST_`. In Production, the application reads the variables without the prefix.

Make sure you copy `.env.example` to `.env` to instantiate your local configuration variables:
```sh
cp .env.example .env
```

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
