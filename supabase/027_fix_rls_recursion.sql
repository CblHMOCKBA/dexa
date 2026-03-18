-- ============================================================
-- DEXA · Patch 027 · Фикс бесконечной рекурсии в RLS rooms
-- Запускать в Supabase SQL Editor
-- ============================================================

-- 1. Дроп всех проблемных политик
drop policy if exists "rooms: member read"   on public.rooms;
drop policy if exists "rooms: auth create"   on public.rooms;
drop policy if exists "rooms: owner update"  on public.rooms;
drop policy if exists "rooms: owner delete"  on public.rooms;
drop policy if exists "room_members: read"   on public.room_members;
drop policy if exists "room_members: insert" on public.room_members;
drop policy if exists "room_members: delete" on public.room_members;

-- 2. SECURITY DEFINER функция — проверяет членство БЕЗ RLS
--    Это ломает рекурсию: функция выполняется как superuser
create or replace function public.is_room_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room_id
      and user_id = p_user_id
  );
$$;

-- 3. Пересоздаём политики rooms — используем функцию вместо прямого JOIN
create policy "rooms: select"
  on public.rooms for select
  using (
    owner_id = auth.uid()
    or not is_private
    or public.is_room_member(id, auth.uid())
  );

create policy "rooms: insert"
  on public.rooms for insert
  with check (auth.uid() = owner_id);

create policy "rooms: update"
  on public.rooms for update
  using (auth.uid() = owner_id);

create policy "rooms: delete"
  on public.rooms for delete
  using (auth.uid() = owner_id);

-- 4. Пересоздаём политики room_members — тоже используем функцию
create policy "room_members: select"
  on public.room_members for select
  using (
    user_id = auth.uid()
    or public.is_room_member(room_id, auth.uid())
  );

create policy "room_members: insert"
  on public.room_members for insert
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.rooms r
      where r.id = room_id
        and r.owner_id = auth.uid()
    )
  );

create policy "room_members: delete"
  on public.room_members for delete
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.rooms r
      where r.id = room_id
        and r.owner_id = auth.uid()
    )
  );

-- 5. Убедимся что триггер добавления owner тоже SECURITY DEFINER
create or replace function public.add_room_owner_as_member()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.room_members (room_id, user_id, role, joined_at, invited_by)
  values (new.id, new.owner_id, 'owner', now(), new.owner_id)
  on conflict (room_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_room_created on public.rooms;
create trigger on_room_created
  after insert on public.rooms
  for each row execute procedure public.add_room_owner_as_member();

-- 6. Grant на функцию
grant execute on function public.is_room_member(uuid, uuid) to authenticated, anon;

-- Проверка — должно вернуть список политик без рекурсии
select tablename, policyname, cmd
from pg_policies
where tablename in ('rooms', 'room_members')
order by tablename, cmd;
