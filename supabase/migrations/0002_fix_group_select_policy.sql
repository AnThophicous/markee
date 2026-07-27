-- Corrige INSERT ... RETURNING em groups.
--
-- A política de SELECT exigia ser membro, mas o gatilho que adiciona o criador
-- como membro (AFTER INSERT) só roda depois que o RETURNING é avaliado. Assim o
-- próprio dono era barrado ao criar o grupo — e insert().select() é o padrão do
-- cliente Supabase. O dono passa a enxergar o grupo sempre.

drop policy if exists "vê grupos que participa ou públicos" on public.groups;

create policy "vê grupos que participa, é dono, ou públicos" on public.groups
  for select to authenticated
  using (is_public or owner_id = auth.uid() or public.is_group_member(id));
