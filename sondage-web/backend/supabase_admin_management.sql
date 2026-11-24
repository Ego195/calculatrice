-- Run after supabase_surveys_migration.sql.
-- Only the FastAPI service role may execute these management functions.

create or replace function public.update_active_survey(survey_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  active_survey_id uuid;
begin
  if char_length(trim(coalesce(survey_data->>'title', ''))) not between 1 and 80
    or char_length(trim(coalesce(survey_data->>'question', ''))) not between 1 and 180
    or char_length(trim(coalesce(survey_data->>'instruction', ''))) not between 1 and 120
    or char_length(trim(coalesce(survey_data->>'choice_heading', ''))) not between 1 and 120
  then
    raise exception 'Survey text fields are invalid';
  end if;

  select id
  into active_survey_id
  from public.surveys
  where is_active
  for update;

  if active_survey_id is null then
    raise exception 'No active survey exists';
  end if;

  update public.surveys
  set title = survey_data->>'title',
      question = survey_data->>'question',
      instruction = survey_data->>'instruction',
      choice_heading = survey_data->>'choice_heading'
  where id = active_survey_id;

  return active_survey_id;
end;
$$;

create or replace function public.delete_archived_survey(target_survey_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform 1
  from public.surveys
  where id = target_survey_id
  for update;

  if not found then
    raise exception 'Survey does not exist';
  end if;

  if exists (
    select 1
    from public.surveys
    where id = target_survey_id
      and is_active
  ) then
    raise exception 'The active survey cannot be deleted';
  end if;

  delete from public.votes
  where survey_id = target_survey_id;

  delete from public.surveys
  where id = target_survey_id;

  return target_survey_id;
end;
$$;

revoke all on function public.update_active_survey(jsonb)
  from public, anon, authenticated;
revoke all on function public.delete_archived_survey(uuid)
  from public, anon, authenticated;

grant execute on function public.update_active_survey(jsonb) to service_role;
grant execute on function public.delete_archived_survey(uuid) to service_role;
