-- Run once in the Supabase SQL Editor for the public FastAPI survey.
-- The public page intentionally displays fictitious nicknames and choices.
alter table public.votes enable row level security;

grant select, insert on table public.votes to anon;
grant usage, select on sequence public.votes_id_seq to anon;

drop policy if exists survey_public_read_votes on public.votes;
create policy survey_public_read_votes
on public.votes
for select
to anon
using (true);

drop policy if exists survey_public_insert_votes on public.votes;
create policy survey_public_insert_votes
on public.votes
for insert
to anon
with check (
  char_length(trim(nickname)) between 1 and 30
  and choice in ('Très bien', 'Bien', 'Moyen', 'À revoir')
);
