-- Rollback the private admin panel settings table after removing the feature.
drop table if exists public.admin_settings;
