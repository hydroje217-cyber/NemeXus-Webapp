# NemeXus Manager Dashboard

React/Vite dashboard for manager and supervisor access.

## Local Setup

Create a local `.env` file beside `package.json`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-or-publishable-key
```

Use the Supabase **Project URL** and **anon public** key from Project Settings > API.
Do not use the `service_role` key in this frontend app.

```bash
npm ci
npm run dev
```

## Vercel Environment Variables

In Vercel, open the project and go to Settings > Environment Variables. Add both variables for Production, Preview, and Development:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

After saving the variables, redeploy from the Deployments tab. Vite reads these values at build time, so an existing deployment will not update until it is rebuilt.

## Notes

Keep `.env` local only. `.env.example` should stay as a placeholder template for setup.
