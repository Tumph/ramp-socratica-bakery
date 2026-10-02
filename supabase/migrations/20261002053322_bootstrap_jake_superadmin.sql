-- Jake has not signed in yet. The existing login flow consumes this record,
-- creates the profile, and grants SUPERADMIN in the same trusted request.
insert into public.superadmin_bootstraps (event_id, email)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'jake@socratica.info')
on conflict (email) do nothing;
