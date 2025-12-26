create extension if not exists "pgcrypto";

create table if not exists user_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  user_role_id uuid references user_roles(id) on delete set null,
  phone_number text,
  passcode text not null,
  last_online timestamptz,
  active boolean not null default true,
  capabilities text[] not null default '{}',
  likes text[] not null default '{}',
  dislikes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into user_roles (name)
values
  ('Admin'),
  ('Volunteer'),
  ('Inactive Volunteer'),
  ('External Volunteer')
on conflict (name) do nothing;

insert into users (display_name, user_role_id, phone_number, passcode)
select
  'Colten Lewis',
  user_roles.id,
  null,
  'WAIANDAINA'
from user_roles
where user_roles.name = 'Admin'
on conflict do nothing;
