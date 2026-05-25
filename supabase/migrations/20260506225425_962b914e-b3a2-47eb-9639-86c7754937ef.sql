-- Dev/bootstrap seed for a specific user; skip if that auth user does not exist (e.g. remote push).
DO $$
DECLARE
  _uid uuid := '3d2a1f75-3913-4773-9a6b-e87d939cf820';
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = _uid) THEN
    DELETE FROM public.user_roles WHERE user_id = _uid;
    INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'admin');
    UPDATE public.profiles SET display_name = 'JP Systems' WHERE user_id = _uid;
  END IF;
END $$;
