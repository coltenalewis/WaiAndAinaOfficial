-- Animalpedia tables and storage metadata.
-- Run this in the Supabase SQL editor to create/update Animalpedia tables.

create table if not exists animal_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default 'default',
  created_at timestamptz not null default now()
);

create table if not exists animal_genders (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default 'default',
  created_at timestamptz not null default now()
);

create table if not exists animals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  summary text,
  daily_care_notes text,
  birthday date,
  arrival_date date,
  age_label text,
  age_months integer,
  status text,
  location text,
  tag_id text,
  microchip_id text,
  health_status text,
  weight_lbs numeric,
  milking_method text,
  get_milked boolean not null default false,
  breed text,
  behaviors text[] not null default '{}',
  stats jsonb not null default '{}'::jsonb,
  animal_type_id uuid references animal_types(id) on delete set null,
  animal_gender_id uuid references animal_genders(id) on delete set null,
  sire_id uuid references animals(id) on delete set null,
  dam_id uuid references animals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table animals
  add column if not exists arrival_date date,
  add column if not exists status text,
  add column if not exists location text,
  add column if not exists tag_id text,
  add column if not exists microchip_id text,
  add column if not exists health_status text,
  add column if not exists weight_lbs numeric,
  add column if not exists sire_id uuid references animals(id) on delete set null,
  add column if not exists dam_id uuid references animals(id) on delete set null;

create table if not exists animal_photos (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid references animals(id) on delete cascade,
  name text,
  path text not null,
  created_at timestamptz not null default now()
);

create index if not exists animal_photos_animal_id_idx on animal_photos(animal_id);
create index if not exists animals_sire_id_idx on animals(sire_id);
create index if not exists animals_dam_id_idx on animals(dam_id);
