# Little Keepsake

A minimalist React app for collecting up to ten compressed photos with a personal note and presenting them as a small digital gift.

## Run locally

```sh
npm install
npm run dev
```

## Enable cross-device sharing

1. In the Supabase SQL editor for your project, run [`supabase/setup.sql`](./supabase/setup.sql). It creates the gifts table, a public photo bucket, upload policies, and functions to retrieve a gift by its unguessable ID and list photos for registered admins.
2. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your Supabase project URL and public anon/publishable key. Never put a Supabase service-role/secret key in the browser app.
3. Restart the dev server after changing environment variables. Create a gift at `/`; its `/gift/:id` URL can be opened from any device when the app is deployed to a public website.
4. For a fixed public app domain, set `VITE_PUBLIC_APP_URL` to that origin (for example, `https://your-app.example.com`). Otherwise, the current website origin is used automatically.

## Admin photo gallery

The `/admin` page lists uploaded gift photos only to Supabase users registered in `public.admin_users`.

1. Create your email/password user in the Supabase dashboard under **Authentication → Users**.
2. Copy that user's UUID and register it in the SQL editor:

   ```sql
   insert into public.admin_users (user_id)
   values ('YOUR-AUTH-USER-UUID');
   ```

3. Open `/admin` on the deployed app and sign in with that account. Do not add the UUID to browser environment variables or share the account credentials.

The admin listing is protected by a database function that checks the signed-in user's UUID against `admin_users`. Gift links remain viewable by anyone who has the link, and the existing photo bucket remains public so those links continue to work. Keep the public anon key in browser code only with the supplied row-level security and storage policies in place.

Photos are resized to a maximum dimension of 1600 pixels and compressed to JPEG in the browser before storage. The app uses Vite, React, Tailwind CSS, and Framer Motion.

## Checks

```sh
npm run lint
npm run build
```
