# First Bites — Play privacy and account deletion setup

## Publish the pages
The patch adds:
- `/privacy/`
- `/delete-account/`

After pushing to GitHub and Vercel redeploying, verify:
- https://first-bites-roan.vercel.app/privacy/
- https://first-bites-roan.vercel.app/delete-account/

## Supabase migration
Run `supabase/account-deletion-support.sql` once in Supabase SQL Editor.

When a verified deletion request arrives:
1. Supabase Dashboard -> Authentication -> Users.
2. Find the user by the email address used to send the request.
3. Delete the user.
4. The trigger cleans up user-authored logs/favorites, removes profile/memberships via existing cascades, transfers owned households if other caregivers remain, or deletes a household if the user was its only member.

## Google Play URLs
Privacy policy URL:
https://first-bites-roan.vercel.app/privacy/

Account deletion URL:
https://first-bites-roan.vercel.app/delete-account/
