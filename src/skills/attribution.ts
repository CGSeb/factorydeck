import { type SQL, sql } from 'drizzle-orm';

function mainThread(): SQL {
  return sql`main_events as (
      select a.session_id, a.at, 0 as rank, a.id as tie, a.id as call_id,
        null::text as sub_agent_id, null::text as skill, false as is_event
      from api_call a join scoped on scoped.id = a.session_id
      where a.sub_agent_id is null
      union all
      select sa.session_id, sa.first_at, 0, 0, null, sa.id, null, false
      from sub_agent sa join scoped on scoped.id = sa.session_id
      where sa.first_at is not null
      union all
      select p.session_id, p.at, 1, p.id, null, null, null, true
      from user_prompt p join scoped on scoped.id = p.session_id
      where not exists (
        select 1 from skill_launch l
        where l.session_id = p.session_id and l.source_path = p.source_path
          and l.record_uuid = p.record_uuid
      )
      union all
      select l.session_id, l.at, 2, l.id, null, null, l.skill, true
      from skill_launch l join scoped on scoped.id = l.session_id
      where l.sub_agent_id is null
    ),
    main_groups as (
      select *, count(*) filter (where is_event) over (
          partition by session_id order by at, rank, tie
          rows between unbounded preceding and current row
        ) as grp
      from main_events
    ),
    main_current as (
      select *, first_value(skill) over (
          partition by session_id, grp order by at, rank, tie
        ) as current_skill
      from main_groups
    )`;
}

function subAgentThreads(): SQL {
  return sql`sub_events as (
      select a.session_id, a.sub_agent_id, a.at, 0 as rank, a.id as tie,
        a.id as call_id, null::text as skill, false as is_event
      from api_call a join scoped on scoped.id = a.session_id
      where a.sub_agent_id is not null
      union all
      select l.session_id, l.sub_agent_id, l.at, 2, l.id, null, l.skill, true
      from skill_launch l join scoped on scoped.id = l.session_id
      where l.sub_agent_id is not null
    ),
    sub_groups as (
      select *, count(*) filter (where is_event) over (
          partition by session_id, sub_agent_id order by at, rank, tie
          rows between unbounded preceding and current row
        ) as grp
      from sub_events
    ),
    sub_current as (
      select *, first_value(skill) over (
          partition by session_id, sub_agent_id, grp order by at, rank, tie
        ) as current_skill
      from sub_groups
    )`;
}

export function attributedCalls(sessions: SQL): SQL {
  return sql`(
    with scoped as (select s.id from project_session s where ${sessions}),
    ${mainThread()},
    ${subAgentThreads()}
    select call_id, current_skill as skill from main_current
    where call_id is not null
    union all
    select g.call_id,
      case when g.grp = 0 then started.current_skill else g.current_skill end
    from sub_current g
    left join main_current started
      on started.session_id = g.session_id and started.sub_agent_id = g.sub_agent_id
    where g.call_id is not null
  )`;
}
