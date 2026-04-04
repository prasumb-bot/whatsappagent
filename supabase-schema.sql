-- ============================================
-- RUN THIS ONCE IN SUPABASE SQL EDITOR
-- It creates everything: tables, indexes, 
-- functions, realtime — in the right order
-- ============================================

-- 1. Businesses table
create table if not exists businesses (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  phone_number_id text not null,
  access_token text not null,
  system_prompt text not null,
  webhook_verify_token text not null,
  created_at timestamp with time zone default now()
);

-- 2. Conversations table
create table if not exists conversations (
  id uuid default gen_random_uuid() primary key,
  phone text not null,
  name text,
  mode text not null default 'agent' check (mode in ('agent', 'human')),
  business_id uuid references businesses(id) on delete cascade,
  updated_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  unique(phone, business_id)
);

-- 3. Messages table
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references conversations(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  whatsapp_msg_id text unique,
  created_at timestamp with time zone default now()
);

-- 4. Indexes
create index if not exists idx_messages_conversation on messages(conversation_id);
create index if not exists idx_conversations_updated on conversations(updated_at desc);
create index if not exists idx_conversations_business on conversations(business_id);
create index if not exists idx_businesses_phone on businesses(phone_number_id);

-- 5. RPC function for dashboard
create or replace function get_conversations_with_last_message(p_business_id uuid default null)
returns table (
  id uuid,
  phone text,
  name text,
  mode text,
  updated_at timestamptz,
  created_at timestamptz,
  last_message text,
  business_id uuid
)
language sql
stable
as $$
  select
    c.id,
    c.phone,
    c.name,
    c.mode,
    c.updated_at,
    c.created_at,
    (
      select m.content
      from messages m
      where m.conversation_id = c.id
      order by m.created_at desc
      limit 1
    ) as last_message,
    c.business_id
  from conversations c
  where (p_business_id is null or c.business_id = p_business_id)
  order by c.updated_at desc;

$$;

-- 6. Enable Realtime
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table businesses;

-- 7. Insert your first test business (update values before running)
-- insert into businesses (name, phone_number_id, access_token, system_prompt, webhook_verify_token)
-- values (
--   'Dr. Demo Clinic',
--   'YOUR_PHONE_NUMBER_ID',
--   'YOUR_ACCESS_TOKEN',
--   'You are a friendly AI assistant for Dr. Demo Clinic...',
--   'your-verify-token'
-- );
-- 8. Appointments table
create table if not exists appointments (
  id uuid default gen_random_uuid() primary key,
  business_id uuid references businesses(id) on delete cascade not null,
  conversation_id uuid references conversations(id) on delete set null,
  patient_name text not null,
  patient_phone text not null,
  appointment_date date not null,
  appointment_time time not null,
  reason text,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'completed', 'no_show')),
  notes text,
  created_at timestamp with time zone default now()
);

create index if not exists idx_appointments_business on appointments(business_id);
create index if not exists idx_appointments_date on appointments(business_id, appointment_date);
create unique index if not exists idx_appointments_slot on appointments(business_id, appointment_date, appointment_time)
  where status = 'confirmed';

alter publication supabase_realtime add table appointments;
