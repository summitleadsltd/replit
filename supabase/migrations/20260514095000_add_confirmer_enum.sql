-- Add 'confirmer' to app_role enum
-- This must be run separately before using the enum value in other migrations
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'confirmer';
