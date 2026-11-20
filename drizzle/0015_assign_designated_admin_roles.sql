UPDATE public.users
SET role = 'super_admin', updated_at = now()
WHERE lower(email) = 'dreamlanguagesuganda@gmail.com';--> statement-breakpoint

UPDATE public.users
SET role = 'admin', updated_at = now()
WHERE lower(email) = 'mabadilikojoseph300@gmail.com';
